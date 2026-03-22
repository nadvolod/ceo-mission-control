// OpenClaw API client for local integration
export class OpenClawClient {
  private baseUrl: string;

  constructor(baseUrl: string = 'http://localhost:3100') {
    this.baseUrl = baseUrl;
  }

  async isAvailable(): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/api/status`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' }
      });
      return response.ok;
    } catch {
      return false;
    }
  }

  async executeCommand(command: string): Promise<any> {
    try {
      const response = await fetch(`${this.baseUrl}/api/exec`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ command })
      });
      return await response.json();
    } catch (error) {
      console.error('OpenClaw command failed:', error);
      throw error;
    }
  }

  async readWorkspaceFile(fileName: string): Promise<string | null> {
    try {
      const response = await fetch(`${this.baseUrl}/api/workspace/read`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fileName })
      });
      const data = await response.json();
      return data.content || null;
    } catch (error) {
      console.error('Failed to read workspace file:', error);
      return null;
    }
  }

  async writeWorkspaceFile(fileName: string, content: string): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/api/workspace/write`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fileName, content })
      });
      return response.ok;
    } catch (error) {
      console.error('Failed to write workspace file:', error);
      return false;
    }
  }

  async getTodaysScorecard(): Promise<any> {
    const content = await this.readWorkspaceFile('DAILY_SCORECARD.md');
    if (!content) return null;
    
    // Parse the scorecard content
    // This would implement the same parsing logic as workspace-reader.ts
    return content;
  }

  async updateTemporalHours(actual: number): Promise<boolean> {
    const scorecard = await this.readWorkspaceFile('DAILY_SCORECARD.md');
    if (!scorecard) return false;

    // Update the "Actual:" line in the scorecard
    const updatedContent = scorecard.replace(
      /- Actual:\s*.*$/m,
      `- Actual: ${actual}`
    );

    return await this.writeWorkspaceFile('DAILY_SCORECARD.md', updatedContent);
  }

  async spawnSubAgent(task: string): Promise<string | null> {
    try {
      const response = await fetch(`${this.baseUrl}/api/subagents/spawn`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ task, cleanup: 'keep' })
      });
      const data = await response.json();
      return data.sessionKey || null;
    } catch (error) {
      console.error('Failed to spawn sub-agent:', error);
      return null;
    }
  }
}

// Singleton instance
export const openClawClient = new OpenClawClient();