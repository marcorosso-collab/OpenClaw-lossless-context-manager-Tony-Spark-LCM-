import { getDb } from './db.js';

export interface Message {
  id?: number;
  sessionKey: string;
  timestamp: string;
  role: 'user' | 'assistant' | 'system' | 'tool';
  content: string;
  tokens?: number;
}

export function storeMessage(message: Message): number {
  const db = getDb();
  const stmt = db.prepare(`
    INSERT INTO messages (session_key, timestamp, role, content, tokens)
    VALUES (?, ?, ?, ?, ?)
  `);
  const result = stmt.run(
    message.sessionKey,
    message.timestamp,
    message.role,
    message.content,
    message.tokens || null
  );
  return result.lastInsertRowid as number;
}

export function getRecentMessages(sessionKey: string, limit: number): Message[] {
  const db = getDb();
  const stmt = db.prepare(`
    SELECT id, session_key as sessionKey, timestamp, role, content, tokens
    FROM messages
    WHERE session_key = ? AND compacted = FALSE
    ORDER BY timestamp DESC
    LIMIT ?
  `);
  return stmt.all(sessionKey, limit) as Message[];
}

export function getUncompactedMessages(sessionKey: string, limit: number): Message[] {
  const db = getDb();
  const stmt = db.prepare(`
    SELECT id, session_key as sessionKey, timestamp, role, content, tokens
    FROM messages
    WHERE session_key = ? AND compacted = FALSE
    ORDER BY timestamp ASC
    LIMIT ?
  `);
  return stmt.all(sessionKey, limit) as Message[];
}

export function markMessagesCompacted(messageIds: number[]): void {
  const db = getDb();
  const placeholders = messageIds.map(() => '?').join(',');
  const stmt = db.prepare(`
    UPDATE messages SET compacted = TRUE WHERE id IN (${placeholders})
  `);
  stmt.run(...messageIds);
}

export function getMessageCount(sessionKey: string): number {
  const db = getDb();
  const stmt = db.prepare(`
    SELECT COUNT(*) as count FROM messages WHERE session_key = ?
  `);
  const result = stmt.get(sessionKey) as { count: number };
  return result.count;
}

export function shouldSkipSummarization(content: string, role: string): boolean {
  // Skip trivial messages
  if (role === 'system') return true;
  if (role === 'tool' && content.length < 50) return true;
  
  const trimmed = content.trim().toLowerCase();
  const skipPatterns = [
    'heartbeat_ok',
    'no_reply',
    'ok',
    'yes',
    'thanks',
    'thank you',
    'got it',
    '👍',
  ];
  
  if (skipPatterns.includes(trimmed)) return true;
  if (trimmed.length < 10) return true;
  
  return false;
}
