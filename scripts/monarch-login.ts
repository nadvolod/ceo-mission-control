#!/usr/bin/env npx tsx
/**
 * One-time Monarch Money login script.
 * Authenticates with email/password (+ optional MFA) and prints the session token.
 *
 * Usage:
 *   npx tsx scripts/monarch-login.ts
 *
 * Then add the token to your environment:
 *   - Local: add MONARCH_TOKEN=<token> to .env.local
 *   - Vercel: vercel env add MONARCH_TOKEN
 */

import readline from 'readline';

async function main() {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stderr, // prompts go to stderr so token can be piped from stdout
  });

  const ask = (prompt: string): Promise<string> =>
    new Promise((resolve) => rl.question(prompt, resolve));

  const askPassword = (prompt: string): Promise<string> =>
    new Promise((resolve) => {
      process.stderr.write(prompt);
      const stdin = process.stdin;
      const wasRaw = stdin.isRaw;
      if (stdin.isTTY) stdin.setRawMode(true);
      let password = '';
      const onData = (ch: Buffer) => {
        const c = ch.toString('utf8');
        if (c === '\n' || c === '\r') {
          stdin.removeListener('data', onData);
          if (stdin.isTTY) stdin.setRawMode(wasRaw ?? false);
          process.stderr.write('\n');
          resolve(password);
        } else if (c === '\u0003') {
          process.exit(1);
        } else if (c === '\u007f' || c === '\b') {
          password = password.slice(0, -1);
        } else {
          password += c;
        }
      };
      stdin.on('data', onData);
    });

  console.error('\nMonarch Money Login\n');
  console.error('This will generate a session token for the MONARCH_TOKEN env var.\n');

  const email = await ask('Email: ');
  const password = await askPassword('Password: ');

  // Dynamic import of ESM package
  const { loginUser, multiFactorAuthenticate, getToken } = await import('monarch-money-api');

  try {
    await loginUser(email, password);
  } catch (error: any) {
    if (error?.message?.includes('Multi-Factor')) {
      console.error('\n2FA required.');
      const code = await ask('Enter 2FA code: ');
      await multiFactorAuthenticate(email, password, code.trim());
    } else {
      console.error('\nLogin failed:', error?.message || error);
      rl.close();
      process.exit(1);
    }
  }

  rl.close();

  const token = getToken();
  if (!token) {
    console.error('\nNo token received. Login may have failed.');
    process.exit(1);
  }

  // Print token to stdout (can be piped)
  console.log(token);

  console.error('\nLogin successful!\n');
  console.error('Add to your environment:');
  console.error('  MONARCH_TOKEN=<token printed above>\n');
  console.error('For Vercel:');
  console.error('  vercel env add MONARCH_TOKEN\n');
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
