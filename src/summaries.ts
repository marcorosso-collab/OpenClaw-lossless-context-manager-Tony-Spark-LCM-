import { getDb } from './db.js';

export interface ChunkSummary {
  id?: number;
  sessionKey: string;
  startMessageId: number;
  endMessageId: number;
  summary: string;
  tokens?: number;
  messageCount: number;
}

export function storeChunkSummary(summary: ChunkSummary): number {
  const db = getDb();
  const stmt = db.prepare(`
    INSERT INTO chunk_summaries (session_key, start_message_id, end_message_id, summary, tokens, message_count)
    VALUES (?, ?, ?, ?, ?, ?)
  `);
  const result = stmt.run(
    summary.sessionKey,
    summary.startMessageId,
    summary.endMessageId,
    summary.summary,
    summary.tokens || null,
    summary.messageCount
  );
  
  // Also add to search index
  const searchStmt = db.prepare(`
    INSERT INTO search_index (content, session_key, source_type, source_id)
    VALUES (?, ?, 'chunk', ?)
  `);
  searchStmt.run(summary.summary, summary.sessionKey, result.lastInsertRowid);
  
  return result.lastInsertRowid as number;
}

export function getChunkSummaries(sessionKey: string, limit: number = 100): ChunkSummary[] {
  const db = getDb();
  const stmt = db.prepare(`
    SELECT id, session_key as sessionKey, start_message_id as startMessageId,
           end_message_id as endMessageId, summary, tokens, message_count as messageCount
    FROM chunk_summaries
    WHERE session_key = ?
    ORDER BY created_at DESC
    LIMIT ?
  `);
  return stmt.all(sessionKey, limit) as ChunkSummary[];
}

export interface DailySummary {
  id?: number;
  sessionKey: string;
  date: string;
  summary: string;
  tokens?: number;
  chunkCount: number;
}

export function storeDailySummary(summary: DailySummary): number {
  const db = getDb();
  const stmt = db.prepare(`
    INSERT INTO daily_summaries (session_key, date, summary, tokens, chunk_count)
    VALUES (?, ?, ?, ?, ?)
  `);
  const result = stmt.run(
    summary.sessionKey,
    summary.date,
    summary.summary,
    summary.tokens || null,
    summary.chunkCount
  );
  
  // Add to search index
  const searchStmt = db.prepare(`
    INSERT INTO search_index (content, session_key, source_type, source_id)
    VALUES (?, ?, 'daily', ?)
  `);
  searchStmt.run(summary.summary, summary.sessionKey, result.lastInsertRowid);
  
  return result.lastInsertRowid as number;
}

export function getDailySummaries(sessionKey: string, limit: number = 30): DailySummary[] {
  const db = getDb();
  const stmt = db.prepare(`
    SELECT id, session_key as sessionKey, date, summary, tokens, chunk_count as chunkCount
    FROM daily_summaries
    WHERE session_key = ?
    ORDER BY date DESC
    LIMIT ?
  `);
  return stmt.all(sessionKey, limit) as DailySummary[];
}
