import { getDb } from './db.js';

export interface SearchResult {
  sourceType: 'message' | 'chunk' | 'daily';
  sourceId: number;
  content: string;
  rank: number;
  timestamp?: string;
}

export function searchContent(query: string, sessionKey?: string, limit: number = 10): SearchResult[] {
  const db = getDb();
  
  // Sanitize query for FTS5
  const sanitizedQuery = query
    .replace(/"/g, '""')
    .split(/\s+/)
    .map(term => `"${term}"`)
    .join(' OR ');
  
  let sql = `
    SELECT s.source_type, s.source_id, s.content, rank
    FROM search_index s
    JOIN search_index_idx i ON s.rowid = i.rowid
    WHERE search_index MATCH ?
  `;
  const params: (string | number)[] = [sanitizedQuery];
  
  if (sessionKey) {
    sql += ' AND s.session_key = ?';
    params.push(sessionKey);
  }
  
  sql += ` ORDER BY rank LIMIT ?`;
  params.push(limit);
  
  const stmt = db.prepare(sql);
  const results = stmt.all(...params) as Array<{
    source_type: string;
    source_id: number;
    content: string;
    rank: number;
  }>;
  
  return results.map(r => ({
    sourceType: r.source_type as 'message' | 'chunk' | 'daily',
    sourceId: r.source_id,
    content: r.content,
    rank: r.rank,
  }));
}

export function getOriginalContent(sourceType: string, sourceId: number): string | null {
  const db = getDb();
  
  if (sourceType === 'message') {
    const stmt = db.prepare('SELECT content FROM messages WHERE id = ?');
    const result = stmt.get(sourceId) as { content: string } | undefined;
    return result?.content || null;
  }
  
  if (sourceType === 'chunk') {
    const stmt = db.prepare('SELECT summary FROM chunk_summaries WHERE id = ?');
    const result = stmt.get(sourceId) as { summary: string } | undefined;
    return result?.summary || null;
  }
  
  if (sourceType === 'daily') {
    const stmt = db.prepare('SELECT summary FROM daily_summaries WHERE id = ?');
    const result = stmt.get(sourceId) as { summary: string } | undefined;
    return result?.summary || null;
  }
  
  return null;
}

export function recallTopic(sessionKey: string, topic: string, daysBack: number = 7): SearchResult[] {
  const db = getDb();
  const since = new Date();
  since.setDate(since.getDate() - daysBack);
  
  // Search in daily summaries first (highest level)
  const dailyStmt = db.prepare(`
    SELECT id, summary as content, date as timestamp
    FROM daily_summaries
    WHERE session_key = ? AND date >= ? AND summary LIKE ?
    ORDER BY date DESC
  `);
  const dailyResults = dailyStmt.all(sessionKey, since.toISOString().split('T')[0], `%${topic}%`) as Array<{
    id: number;
    content: string;
    timestamp: string;
  }>;
  
  // Search in chunk summaries
  const chunkStmt = db.prepare(`
    SELECT id, summary as content, created_at as timestamp
    FROM chunk_summaries
    WHERE session_key = ? AND created_at >= ? AND summary LIKE ?
    ORDER BY created_at DESC
  `);
  const chunkResults = chunkStmt.all(sessionKey, since.toISOString(), `%${topic}%`) as Array<{
    id: number;
    content: string;
    timestamp: string;
  }>;
  
  return [
    ...dailyResults.map(r => ({
      sourceType: 'daily' as const,
      sourceId: r.id,
      content: r.content,
      rank: 1,
      timestamp: r.timestamp,
    })),
    ...chunkResults.map(r => ({
      sourceType: 'chunk' as const,
      sourceId: r.id,
      content: r.content,
      rank: 0.5,
      timestamp: r.timestamp,
    })),
  ];
}
