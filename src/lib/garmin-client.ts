import { GarminConnect, MFAManager } from '@gooin/garmin-connect';
import type { GarminDayMetrics } from './types';
import { loadJSON, saveJSON } from './storage';

const TOKEN_KEY = 'garmin-tokens.json';

interface TokenCache {
  oauth1: unknown;
  oauth2: unknown;
  savedAt: string;
}

// ---------------------------------------------------------------------------
// Token management
// ---------------------------------------------------------------------------

async function saveTokens(client: GarminConnect): Promise<void> {
  const tokens = client.exportToken();
  await saveJSON(TOKEN_KEY, { ...tokens, savedAt: new Date().toISOString() });
}

async function getClientWithCachedTokens(): Promise<GarminConnect | null> {
  const email = process.env.GARMIN_EMAIL;
  const password = process.env.GARMIN_PASSWORD;
  if (!email || !password) return null;

  const cached = await loadJSON<TokenCache | null>(TOKEN_KEY, null);
  if (!cached?.oauth1 || !cached?.oauth2) return null;

  const client = new GarminConnect({ username: email, password });
  try {
    client.loadToken(
      cached.oauth1 as Parameters<GarminConnect['loadToken']>[0],
      cached.oauth2 as Parameters<GarminConnect['loadToken']>[1]
    );
    await client.getUserSettings();
    console.log('Garmin: authenticated with cached tokens');
    return client;
  } catch {
    console.log('Garmin: cached tokens expired');
    return null;
  }
}

// ---------------------------------------------------------------------------
// Login with MFA support (two-step)
// ---------------------------------------------------------------------------

/**
 * Step 1: Initiate Garmin login. If MFA is required, returns sessionId.
 * The caller must then call `completeMFALogin(sessionId, code)` with the
 * code sent to the user's email.
 */
export async function initiateGarminLogin(): Promise<{
  success: boolean;
  mfaRequired?: boolean;
  sessionId?: string;
  error?: string;
}> {
  const email = process.env.GARMIN_EMAIL;
  const password = process.env.GARMIN_PASSWORD;

  if (!email || !password) {
    return { success: false, error: 'GARMIN_EMAIL and GARMIN_PASSWORD environment variables are required' };
  }

  // Check if we already have valid tokens
  const existing = await getClientWithCachedTokens();
  if (existing) {
    return { success: true };
  }

  const client = new GarminConnect({
    username: email,
    password,
    mfa: { type: 'file', dir: '/tmp' },
  });

  try {
    await client.login(email, password);
    // Login succeeded without MFA
    await saveTokens(client);
    return { success: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    // Check if this is an MFA requirement
    if (message.includes('MFA') || message.includes('验证')) {
      // MFA is required — get the session ID from MFAManager
      const mfaManager = MFAManager.getInstance({ type: 'file', dir: '/tmp' });
      const sessions = await mfaManager.getActiveSessions();
      if (sessions.length > 0) {
        return { success: false, mfaRequired: true, sessionId: sessions[sessions.length - 1] };
      }
      return { success: false, mfaRequired: true, error: 'MFA required but no session created. Check Garmin credentials.' };
    }
    return { success: false, error: message };
  }
}

/**
 * Step 2: Complete login by submitting the MFA code from email.
 */
export async function completeMFALogin(sessionId: string, code: string): Promise<{
  success: boolean;
  error?: string;
}> {
  const email = process.env.GARMIN_EMAIL;
  const password = process.env.GARMIN_PASSWORD;

  if (!email || !password) {
    return { success: false, error: 'GARMIN_EMAIL and GARMIN_PASSWORD not configured' };
  }

  try {
    const mfaManager = MFAManager.getInstance({ type: 'file', dir: '/tmp' });
    await mfaManager.submitMFACode(sessionId, code);

    // Wait briefly for the login to complete with the MFA code
    await new Promise(resolve => setTimeout(resolve, 3000));

    // Try to get tokens now
    const client = new GarminConnect({
      username: email,
      password,
      mfa: { type: 'file', dir: '/tmp' },
    });

    // Attempt login again — should complete now with MFA code submitted
    await client.login(email, password, sessionId);
    await saveTokens(client);

    return { success: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { success: false, error: `MFA verification failed: ${message}` };
  }
}

// ---------------------------------------------------------------------------
// Per-metric fetchers (mirrors Python script's structure)
// ---------------------------------------------------------------------------

function toHHMM(epochMs: number | null | undefined): string | null {
  if (epochMs == null) return null;
  const dt = new Date(epochMs);
  return dt.toISOString().slice(11, 16);
}

function secondsToMinutes(val: number | null | undefined): number | null {
  if (val == null) return null;
  return Math.round(val / 60);
}

async function fetchSleep(client: GarminConnect, date: Date): Promise<Partial<GarminDayMetrics>> {
  try {
    const data = await client.getSleepData(date);
    if (!data?.dailySleepDTO) return {};

    const dto = data.dailySleepDTO;
    const result: Partial<GarminDayMetrics> = {};

    const score = dto.sleepScores?.overall?.value;
    if (score != null) result.sleepScore = score;
    if (dto.sleepTimeSeconds != null) result.sleepDurationMinutes = secondsToMinutes(dto.sleepTimeSeconds);
    if (dto.deepSleepSeconds != null) result.deepSleepMinutes = secondsToMinutes(dto.deepSleepSeconds);
    if (dto.lightSleepSeconds != null) result.lightSleepMinutes = secondsToMinutes(dto.lightSleepSeconds);
    if (dto.remSleepSeconds != null) result.remSleepMinutes = secondsToMinutes(dto.remSleepSeconds);
    if (dto.awakeSleepSeconds != null) result.awakeDuringMinutes = secondsToMinutes(dto.awakeSleepSeconds);

    const start = dto.sleepStartTimestampGMT ?? dto.sleepStartTimestampLocal;
    const end = dto.sleepEndTimestampGMT ?? dto.sleepEndTimestampLocal;
    if (start) result.sleepStartTime = toHHMM(start);
    if (end) result.sleepEndTime = toHHMM(end);

    // SleepData also provides HRV and resting HR
    if (data.avgOvernightHrv != null) result.hrvStatus = data.avgOvernightHrv;
    if (data.restingHeartRate != null) result.restingHeartRate = data.restingHeartRate;

    return result;
  } catch (err) {
    console.warn(`Garmin: sleep fetch failed for ${date.toISOString().slice(0, 10)}:`, err);
    return {};
  }
}

async function fetchHeartRate(client: GarminConnect, date: Date): Promise<Partial<GarminDayMetrics>> {
  try {
    const data = await client.getHeartRate(date);
    if (data?.restingHeartRate != null) {
      return { restingHeartRate: data.restingHeartRate };
    }
    return {};
  } catch (err) {
    console.warn(`Garmin: heart rate fetch failed for ${date.toISOString().slice(0, 10)}:`, err);
    return {};
  }
}

async function fetchStressAndSteps(client: GarminConnect, dateStr: string): Promise<Partial<GarminDayMetrics>> {
  try {
    const data = await client.get<Record<string, unknown>>(
      `https://connect.garmin.com/modern/proxy/usersummary-service/usersummary/daily/${dateStr}`
    );
    if (!data) return {};

    const result: Partial<GarminDayMetrics> = {};
    if (typeof data.averageStressLevel === 'number') result.averageStressLevel = data.averageStressLevel;
    if (typeof data.totalSteps === 'number') result.steps = data.totalSteps;

    const moderate = typeof data.moderateIntensityMinutes === 'number' ? data.moderateIntensityMinutes : 0;
    const vigorous = typeof data.vigorousIntensityMinutes === 'number' ? data.vigorousIntensityMinutes : 0;
    if (moderate > 0 || vigorous > 0) result.activeMinutes = moderate + vigorous;

    return result;
  } catch (err) {
    console.warn(`Garmin: stress/steps fetch failed for ${dateStr}:`, err);
    return {};
  }
}

async function fetchBodyBattery(client: GarminConnect, dateStr: string): Promise<Partial<GarminDayMetrics>> {
  try {
    const data = await client.get<Array<{ charged?: number }>>(
      `https://connect.garmin.com/modern/proxy/wellness-service/wellness/bodyBattery/dates/${dateStr}/${dateStr}`
    );
    if (!Array.isArray(data) || data.length === 0) return {};

    const charged = data.map(r => r.charged).filter((v): v is number => v != null);
    if (charged.length === 0) return {};

    return {
      bodyBatteryHigh: Math.max(...charged),
      bodyBatteryLow: Math.min(...charged),
    };
  } catch (err) {
    console.warn(`Garmin: body battery fetch failed for ${dateStr}:`, err);
    return {};
  }
}

async function fetchWeight(client: GarminConnect, dateStr: string): Promise<Partial<GarminDayMetrics>> {
  try {
    const data = await client.get<Array<{ weight?: number }>>(
      `https://connect.garmin.com/modern/proxy/weight-service/weight/dateRange/${dateStr}/${dateStr}`
    );
    if (!Array.isArray(data) || data.length === 0) return {};

    const last = data[data.length - 1];
    if (last.weight != null) {
      return { weight: Math.round((last.weight / 453.592) * 10) / 10 };
    }
    return {};
  } catch (err) {
    console.warn(`Garmin: weight fetch failed for ${dateStr}:`, err);
    return {};
  }
}

// ---------------------------------------------------------------------------
// Data sync (requires cached tokens from prior login)
// ---------------------------------------------------------------------------

export async function fetchGarminMetrics(days: number): Promise<{
  metrics: GarminDayMetrics[];
  error: string | null;
}> {
  const client = await getClientWithCachedTokens();
  if (!client) {
    return {
      metrics: [],
      error: 'Garmin not connected. Go to Settings → Garmin Sync → Connect to authenticate.',
    };
  }

  const now = new Date();
  const metrics: GarminDayMetrics[] = [];

  for (let i = days - 1; i >= 0; i--) {
    const date = new Date(now);
    date.setDate(date.getDate() - i);
    const dateStr = date.toISOString().slice(0, 10);

    console.log(`Garmin: fetching ${dateStr} ...`);

    const [sleep, hr, stressSteps, bodyBattery, weight] = await Promise.all([
      fetchSleep(client, date),
      fetchHeartRate(client, date),
      fetchStressAndSteps(client, dateStr),
      fetchBodyBattery(client, dateStr),
      fetchWeight(client, dateStr),
    ]);

    const dayMetrics: GarminDayMetrics = {
      date: dateStr,
      sleepScore: null,
      sleepDurationMinutes: null,
      sleepStartTime: null,
      sleepEndTime: null,
      deepSleepMinutes: null,
      lightSleepMinutes: null,
      remSleepMinutes: null,
      awakeDuringMinutes: null,
      restingHeartRate: null,
      hrvStatus: null,
      averageStressLevel: null,
      bodyBatteryHigh: null,
      bodyBatteryLow: null,
      steps: null,
      activeMinutes: null,
      weight: null,
      syncedAt: new Date().toISOString(),
      ...sleep,
      ...hr,
      ...stressSteps,
      ...bodyBattery,
      ...weight,
    };

    metrics.push(dayMetrics);
  }

  // Save refreshed tokens
  try {
    await saveTokens(client);
  } catch {
    // Token save failure is non-fatal
  }

  console.log(`Garmin: fetched ${metrics.length} day(s)`);
  return { metrics, error: null };
}
