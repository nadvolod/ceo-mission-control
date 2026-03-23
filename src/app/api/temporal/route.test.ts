import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { NextRequest } from 'next/server';
import { GET, POST } from './route';
import fs from 'fs';
import path from 'path';

// Mock fs module
jest.mock('fs', () => ({
  readFileSync: jest.fn(),
  writeFileSync: jest.fn(),
}));

const mockReadFileSync = fs.readFileSync as jest.MockedFunction<typeof fs.readFileSync>;
const mockWriteFileSync = fs.writeFileSync as jest.MockedFunction<typeof fs.writeFileSync>;

describe('/api/temporal', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.NODE_ENV = 'test';
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  describe('GET /api/temporal', () => {
    it('should return empty sessions when file does not exist', async () => {
      mockReadFileSync.mockImplementation(() => {
        throw new Error('ENOENT: no such file or directory');
      });

      const response = await GET();
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toEqual({
        success: true,
        sessions: [],
        dailyTotals: {}
      });
    });

    it('should return existing temporal data when file exists', async () => {
      const mockData = {
        sessions: [
          {
            id: 'test-session-1',
            startTime: '2026-03-23T06:30:00.000Z',
            endTime: '2026-03-23T08:30:00.000Z',
            duration: 2,
            description: 'Morning focus block',
            date: '2026-03-23'
          }
        ],
        dailyTotals: {
          '2026-03-23': 2
        }
      };

      mockReadFileSync.mockReturnValue(JSON.stringify(mockData));

      const response = await GET();
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.sessions).toHaveLength(1);
      expect(data.sessions[0].duration).toBe(2);
      expect(data.dailyTotals['2026-03-23']).toBe(2);
    });

    it('should handle file read errors gracefully', async () => {
      mockReadFileSync.mockImplementation(() => {
        throw new Error('Permission denied');
      });

      const response = await GET();
      
      expect(response.status).toBe(200);
      expect(await response.json()).toEqual({
        success: true,
        sessions: [],
        dailyTotals: {}
      });
    });
  });

  describe('POST /api/temporal', () => {
    it('should add a new temporal session and update files', async () => {
      // Mock existing temporal data
      const existingData = {
        sessions: [],
        dailyTotals: {}
      };
      
      // Mock existing scorecard content
      const scorecardContent = `# DAILY_SCORECARD.md

## Date
- 2026-03-23

## Temporal focused hours target
- Target today: 4.0
- Actual:

## Focus blocks
- Block 1: 6:30-8:30 AM`;

      const memoryContent = `# Daily Memory - 2026-03-23

## Existing content`;

      mockReadFileSync
        .mockReturnValueOnce(JSON.stringify(existingData)) // temporal data
        .mockReturnValueOnce(scorecardContent) // scorecard
        .mockReturnValueOnce(memoryContent); // memory file

      const request = new NextRequest('http://localhost:3000/api/temporal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'addSession',
          hours: 2.5,
          description: 'Morning focus blocks completed'
        })
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.session.duration).toBe(2.5);
      expect(data.session.description).toBe('Morning focus blocks completed');
      expect(data.newTotal).toBe(2.5);

      // Verify temporal data was saved
      expect(mockWriteFileSync).toHaveBeenCalledWith(
        expect.stringContaining('temporal-tracking.json'),
        expect.stringContaining('"duration":2.5'),
        { encoding: undefined }
      );

      // Verify scorecard was updated
      expect(mockWriteFileSync).toHaveBeenCalledWith(
        expect.stringContaining('DAILY_SCORECARD.md'),
        expect.stringContaining('- Actual: 2.5'),
        { encoding: undefined }
      );

      // Verify memory was updated
      expect(mockWriteFileSync).toHaveBeenCalledWith(
        expect.stringContaining('memory/2026-03-23.md'),
        expect.stringContaining('## Temporal Session Completed'),
        { encoding: undefined }
      );
    });

    it('should accumulate hours when multiple sessions are added', async () => {
      // Mock existing temporal data with one session
      const existingData = {
        sessions: [
          {
            id: 'existing-session',
            startTime: '2026-03-23T06:30:00.000Z',
            endTime: '2026-03-23T08:30:00.000Z',
            duration: 2,
            description: 'First session',
            date: '2026-03-23'
          }
        ],
        dailyTotals: {
          '2026-03-23': 2
        }
      };

      const scorecardContent = `# DAILY_SCORECARD.md
## Temporal focused hours target
- Target today: 4.0
- Actual: 2`;

      mockReadFileSync
        .mockReturnValueOnce(JSON.stringify(existingData)) // temporal data
        .mockReturnValueOnce(scorecardContent); // scorecard

      const request = new NextRequest('http://localhost:3000/api/temporal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'addSession',
          hours: 1.5,
          description: 'Afternoon session'
        })
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.newTotal).toBe(3.5); // 2 + 1.5
      expect(data.session.duration).toBe(1.5);
    });

    it('should create memory file if it does not exist', async () => {
      const existingData = { sessions: [], dailyTotals: {} };
      const scorecardContent = '# DAILY_SCORECARD.md\n- Target today: 4.0\n- Actual:';

      mockReadFileSync
        .mockReturnValueOnce(JSON.stringify(existingData))
        .mockReturnValueOnce(scorecardContent)
        .mockImplementation(() => { throw new Error('ENOENT'); }); // Memory file doesn't exist

      const request = new NextRequest('http://localhost:3000/api/temporal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'addSession',
          hours: 1,
          description: 'Test session'
        })
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);

      // Verify new memory file was created
      expect(mockWriteFileSync).toHaveBeenCalledWith(
        expect.stringContaining('memory/2026-03-23.md'),
        expect.stringContaining('# Daily Memory - 2026-03-23'),
        { encoding: undefined }
      );
    });

    it('should reject invalid actions', async () => {
      const request = new NextRequest('http://localhost:3000/api/temporal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'invalidAction',
          hours: 2
        })
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.error).toBe('Invalid action');
    });

    it('should handle missing hours parameter', async () => {
      const request = new NextRequest('http://localhost:3000/api/temporal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'addSession'
          // Missing hours parameter
        })
      });

      const response = await POST(request);
      
      expect(response.status).toBe(500);
      expect((await response.json()).success).toBe(false);
    });

    it('should use default description when none provided', async () => {
      const existingData = { sessions: [], dailyTotals: {} };
      const scorecardContent = '# DAILY_SCORECARD.md\n- Target today: 4.0\n- Actual:';

      mockReadFileSync
        .mockReturnValueOnce(JSON.stringify(existingData))
        .mockReturnValueOnce(scorecardContent);

      const request = new NextRequest('http://localhost:3000/api/temporal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'addSession',
          hours: 1.5
          // No description provided
        })
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.session.description).toBe('1.5h Temporal block completed');
    });
  });
});