import Database from 'better-sqlite3';
import { getConfig } from './config.js';

let db: Database.Database | null = null;

export function getDb(): Database.Database {
  if (!db) {
    const config = getConfig();
    db = new Database(config.dbPath);
    db.pragma('journal_mode = WAL');
    initializeSchema(db);
  }
  return db;
}

function initializeSchema(db: Database.Database): void {
  // Raw messages
  db.exec(`
    CREATE TABLE IF NOT EXISTS messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      session_key TEXT NOT NULL,
      timestamp TEXT NOT NULL,
      role TEXT NOT NULL,
      content TEXT NOT NULL,
      tokens INTEGER,
      compacted BOOLEAN DEFAULT FALSE,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX IF NOT EXISTS idx_messages_session ON messages(session_key);
    CREATE INDEX IF NOT EXISTS idx_messages_timestamp ON messages(timestamp);
    CREATE INDEX IF NOT EXISTS idx_messages_compacted ON messages(compacted) WHERE compacted = FALSE;
  `);

  // Chunk summaries (Level 1)
  db.exec(`
    CREATE TABLE IF NOT EXISTS chunk_summaries (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      session_key TEXT NOT NULL,
      start_message_id INTEGER NOT NULL,
      end_message_id INTEGER NOT NULL,
      summary TEXT NOT NULL,
      tokens INTEGER,
      message_count INTEGER NOT NULL,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (start_message_id) REFERENCES messages(id),
      FOREIGN KEY (end_message_id) REFERENCES messages(id)
    );
    CREATE INDEX IF NOT EXISTS idx_chunks_session ON chunk_summaries(session_key);
  `);

  // Daily summaries (Level 2)
  db.exec(`
    CREATE TABLE IF NOT EXISTS daily_summaries (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      session_key TEXT NOT NULL,
      date TEXT NOT NULL,
      summary TEXT NOT NULL,
      tokens INTEGER,
      chunk_count INTEGER NOT NULL,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX IF NOT EXISTS idx_daily_session ON daily_summaries(session_key);
    CREATE INDEX IF NOT EXISTS idx_daily_date ON daily_summaries(date);
  `);

  // FTS5 for search
  db.exec(`
    CREATE VIRTUAL TABLE IF NOT EXISTS search_index USING fts5(
      content,
      session_key,
      source_type,
      source_id,
      tokenize='porter'
    );
  `);
}

export function closeDb(): void {
  if (db) {
    db.close();
    db = null;
  }
}
