import type { NeonQueryFunction } from '@neondatabase/serverless';

export type Sql = NeonQueryFunction<false, false>;

export interface Migration {
  version: string;
  description: string;
  up(sql: Sql): Promise<void>;
}
