import { getConfig } from './config.js';
import { getRecentMessages, getMessageCount, Message, storeMessage } from './messages.js';
import { getChunkSummaries, getDailySummaries } from './summaries.js';
import { searchContent, recallTopic, SearchResult } from './search.js';
import { compactSession, shouldCompact, generateDailySummary } from './compaction.js';
import { syncSummariesToMemory } from './memory-sync.js';

export interface LCMStatus {
  enabled: boolean;
  totalMessages: number;
  uncompactedMessages: number;
  chunkSummaries: number;
  dailySummaries: number;
  dbPath: string;
  shouldCompact: boolean;
}

export class TonyLCM {
  private sessionKey: string;
  
  constructor(sessionKey: string) {
    this.sessionKey = sessionKey;
  }
  
  status(): LCMStatus {
    const config = getConfig();
    const messages = getRecentMessages(this.sessionKey, 10000);
    const chunks = getChunkSummaries(this.sessionKey, 10000);
    const dailies = getDailySummaries(this.sessionKey, 100);
    
    return {
      enabled: config.enabled,
      totalMessages: getMessageCount(this.sessionKey),
      uncompactedMessages: messages.length,
      chunkSummaries: chunks.length,
      dailySummaries: dailies.length,
      dbPath: config.dbPath,
      shouldCompact: false, // Would check actual context tokens
    };
  }
  
  store(message: Message): void {
    storeMessage({ ...message, sessionKey: this.sessionKey });
  }
  
  syncToMemory(date?: string): number {
    const targetDate = date || new Date().toISOString().split('T')[0];
    const chunks = getChunkSummaries(this.sessionKey, 100);
    const dayChunks = chunks.filter(c => {
      // Simple date filter - in production would parse properly
      return true;
    });
    
    if (dayChunks.length === 0) return 0;
    
    const chunkSummaries = dayChunks.map(c => c.summary);
    return syncSummariesToMemory(chunkSummaries, targetDate);
  }
  
  async compact(force: boolean = false): Promise<{ success: boolean; message: string }> {
    const result = await compactSession(this.sessionKey, force);
    
    if (result.success) {
      if (result.chunksCreated === 0) {
        return { success: true, message: 'No compaction needed - not enough messages yet.' };
      }
      return {
        success: true,
        message: `Compacted ${result.messagesCompacted} messages into ${result.chunksCreated} chunks. Estimated ${result.tokensSaved} tokens saved.`,
      };
    }
    
    return { success: false, message: result.error || 'Compaction failed' };
  }
  
  search(query: string, limit: number = 10): SearchResult[] {
    return searchContent(query, this.sessionKey, limit);
  }
  
  recall(topic: string, daysBack: number = 7): SearchResult[] {
    return recallTopic(this.sessionKey, topic, daysBack);
  }
  
  async dailyRollup(date?: string): Promise<boolean> {
    const targetDate = date || new Date().toISOString().split('T')[0];
    return generateDailySummary(this.sessionKey, targetDate);
  }
}

// Export singleton for default session
let defaultLCM: TonyLCM | null = null;

export function getLCM(sessionKey: string = 'default'): TonyLCM {
  if (!defaultLCM || defaultLCM['sessionKey'] !== sessionKey) {
    defaultLCM = new TonyLCM(sessionKey);
  }
  return defaultLCM;
}

export { searchContent, recallTopic, shouldCompact };
