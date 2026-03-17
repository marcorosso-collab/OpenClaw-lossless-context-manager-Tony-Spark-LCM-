import { getConfig } from './config.js';
import { getUncompactedMessages, markMessagesCompacted, shouldSkipSummarization, Message } from './messages.js';
import { storeChunkSummary, getChunkSummaries, storeDailySummary } from './summaries.js';
import { syncSummariesToMemory } from './memory-sync.js';

export interface CompactionResult {
  success: boolean;
  chunksCreated: number;
  messagesCompacted: number;
  tokensSaved: number;
  error?: string;
}

export async function compactSession(sessionKey: string, force: boolean = false): Promise<CompactionResult> {
  const config = getConfig();
  
  if (!config.enabled && !force) {
    return { success: false, chunksCreated: 0, messagesCompacted: 0, tokensSaved: 0, error: 'LCM disabled' };
  }
  
  try {
    // Get uncompacted messages
    const messages = getUncompactedMessages(sessionKey, config.chunkSize * 2);
    
    // Filter out messages that should be skipped
    const eligibleMessages = messages.filter(m => !shouldSkipSummarization(m.content, m.role));
    
    if (eligibleMessages.length < config.chunkSize && !force) {
      return { success: true, chunksCreated: 0, messagesCompacted: 0, tokensSaved: 0 };
    }
    
    // Create chunks
    const chunks: Message[][] = [];
    for (let i = 0; i < eligibleMessages.length; i += config.chunkSize) {
      chunks.push(eligibleMessages.slice(i, i + config.chunkSize));
    }
    
    let chunksCreated = 0;
    let messagesCompacted = 0;
    let tokensSaved = 0;
    
    for (const chunk of chunks) {
      if (chunk.length < 5) continue; // Skip tiny chunks
      
      const summary = await generateSummary(chunk);
      const messageIds = chunk.map(m => m.id!).filter(Boolean);
      
      storeChunkSummary({
        sessionKey,
        startMessageId: messageIds[0],
        endMessageId: messageIds[messageIds.length - 1],
        summary,
        messageCount: chunk.length,
      });
      
      markMessagesCompacted(messageIds);
      
      chunksCreated++;
      messagesCompacted += chunk.length;
      tokensSaved += estimateTokens(chunk.map(m => m.content).join(' ')) - estimateTokens(summary);
    }
    
    return { success: true, chunksCreated, messagesCompacted, tokensSaved };
  } catch (error) {
    return {
      success: false,
      chunksCreated: 0,
      messagesCompacted: 0,
      tokensSaved: 0,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

export async function generateDailySummary(sessionKey: string, date: string): Promise<boolean> {
  const chunks = getChunkSummaries(sessionKey, 100);
  const dayChunks = chunks.filter(c => {
    // Filter chunks from the specific date
    // This is simplified - would need proper date parsing
    return true;
  });
  
  if (dayChunks.length === 0) return false;
  
  const combinedSummary = dayChunks.map(c => c.summary).join('\n\n');
  const dailySummary = await condenseSummary(combinedSummary, 'daily');
  
  storeDailySummary({
    sessionKey,
    date,
    summary: dailySummary,
    chunkCount: dayChunks.length,
  });
  
  // Auto-sync to MEMORY.md if enabled
  const config = getConfig();
  if (config.autoSyncToMemory) {
    const chunkSummaries = dayChunks.map(c => c.summary);
    syncSummariesToMemory(chunkSummaries, date);
  }
  
  return true;
}

async function generateSummary(messages: Message[]): Promise<string> {
  // Format messages for summarization
  const formatted = messages.map(m => {
    const role = m.role === 'user' ? 'User' : m.role === 'assistant' ? 'Assistant' : 'System';
    return `${role}: ${m.content}`;
  }).join('\n\n');
  
  // For now, return a simple extractive summary
  // In production, this would call an LLM API
  const keyPoints = messages
    .filter(m => m.role === 'user' || m.content.length > 100)
    .map(m => m.content.substring(0, 200) + (m.content.length > 200 ? '...' : ''));
  
  return `Summary of ${messages.length} messages:\n${keyPoints.slice(0, 5).join('\n- ')}`;
}

async function condenseSummary(summaries: string, level: 'chunk' | 'daily'): Promise<string> {
  // In production, this would call an LLM to condense
  // For now, return truncated
  const lines = summaries.split('\n');
  return lines.slice(0, 20).join('\n') + (lines.length > 20 ? '\n...' : '');
}

function estimateTokens(text: string): number {
  // Rough estimate: ~4 characters per token
  return Math.ceil(text.length / 4);
}

export function shouldCompact(contextTokens: number, maxTokens: number): boolean {
  const config = getConfig();
  return contextTokens >= maxTokens * config.contextThreshold;
}
