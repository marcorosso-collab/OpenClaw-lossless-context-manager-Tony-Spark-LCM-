import Database from 'better-sqlite3';
import { join } from 'path';
import { homedir } from 'os';

export interface LCMConfig {
  enabled: boolean;
  dbPath: string;
  contextThreshold: number;
  freshTailCount: number;
  chunkSize: number;
  summaryModel: string;
  autoSyncToMemory: boolean;
}

export const defaultConfig: LCMConfig = {
  enabled: true,
  dbPath: join(homedir(), '.openclaw/workspace/data/tony-lcm.db'),
  contextThreshold: 0.75,
  freshTailCount: 32,
  chunkSize: 15,
  summaryModel: 'anthropic/claude-3-haiku',
  autoSyncToMemory: true,
};

export function getConfig(): LCMConfig {
  // TODO: Load from OpenClaw config if available
  return defaultConfig;
}
