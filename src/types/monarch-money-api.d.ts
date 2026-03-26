declare module 'monarch-money-api' {
  export function setToken(token: string): void;
  export function getToken(): string | null;
  export function getHeaders(): Record<string, string>;

  export function loginUser(
    email: string,
    password: string,
    mfaSecretKey?: string
  ): Promise<void>;

  export function multiFactorAuthenticate(
    email: string,
    password: string,
    code: string
  ): Promise<void>;

  export function interactiveLogin(
    useSavedSession?: boolean,
    saveSessionFlag?: boolean
  ): Promise<void>;

  export function getAccounts(): Promise<{
    accounts: Array<{
      id: string;
      displayName: string;
      currentBalance: number;
      displayBalance: number;
      isAsset: boolean;
      isHidden: boolean;
      syncDisabled: boolean;
      includeInNetWorth: boolean;
      deactivatedAt: string | null;
      updatedAt: string;
      displayLastUpdatedAt: string;
      logoUrl: string | null;
      type: { name: string; display: string };
      subtype: { name: string; display: string };
      institution: { id: string; name: string } | null;
      credential: {
        id: string;
        updateRequired: boolean;
        disconnectedFromDataProviderAt: string | null;
        institution: { id: string; name: string } | null;
      } | null;
    }>;
    householdPreferences: { id: string; accountGroupOrder: string[] };
  }>;

  export function getCashflowSummary(options?: {
    limit?: number;
    startDate?: string;
    endDate?: string;
  }): Promise<{
    summary: Array<{
      summary: {
        sumIncome: number;
        sumExpense: number;
        savings: number;
        savingsRate: number;
      };
    }>;
  }>;

  export function getTransactions(options?: {
    limit?: number;
    offset?: number;
    startDate?: string;
    endDate?: string;
    search?: string;
    categoryIds?: string[];
    accountIds?: string[];
    tagIds?: string[];
  }): Promise<{
    allTransactions: {
      totalCount: number;
      results: Array<{
        id: string;
        amount: number;
        date: string;
        pending: boolean;
        notes: string | null;
        isRecurring: boolean;
        merchant: { name: string; id: string } | null;
        category: { id: string; name: string; group: { id: string; type: string } } | null;
      }>;
    };
  }>;

  export class RequireMFAException extends Error {}
  export class LoginFailedException extends Error {}
  export class RequestFailedException extends Error {}
}
