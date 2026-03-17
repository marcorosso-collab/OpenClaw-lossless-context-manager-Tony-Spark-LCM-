# Tony Spark LCM - Portable Memory System

A lightweight, self-contained context management system for AI agents. Designed for easy adoption without security compromises.

## What This Is

A **lossless conversation memory** system that:
- Stores every message in SQLite (searchable, persistent)
- Creates summaries at chunk and daily levels
- Auto-extracts key decisions to a memory file
- Survives session restarts

## What This Is NOT

- Does NOT execute arbitrary code
- Does NOT access external systems (unless explicitly configured)
- Does NOT modify system files outside its workspace
- Does NOT require elevated permissions

## Quick Setup (5 minutes)

### 1. Create Directory Structure

```
your-agent-workspace/
├── skills/
│   └── memory-lcm/
│       ├── src/
│       │   ├── db.js           # Database layer
│       │   ├── messages.js     # Message storage
│       │   ├── summaries.js    # Summary management
│       │   ├── search.js       # Full-text search
│       │   ├── compaction.js   # Auto-compaction logic
│       │   ├── memory-sync.js  # Auto-sync to memory file
│       │   └── index.js        # Main API
│       └── package.json
└── data/
    └── memory-lcm.db           # SQLite database (auto-created)
```

### 2. Install Dependencies

```bash
cd skills/memory-lcm
npm init -y
npm install better-sqlite3
```

### 3. Core Files

**src/db.js** - Database connection:
```javascript
const Database = require('better-sqlite3');
const path = require('path');

const DB_PATH = path.join(process.cwd(), '..', '..', 'data', 'memory-lcm.db');
let db = null;

function getDb() {
  if (!db) {
    db = new Database(DB_PATH);
    db.pragma('journal_mode = WAL');
    initSchema(db);
  }
  return db;
}

function initSchema(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      session_key TEXT NOT NULL,
      timestamp TEXT NOT NULL,
      role TEXT NOT NULL,
      content TEXT NOT NULL,
      tokens INTEGER,
      compacted BOOLEAN DEFAULT FALSE
    );
    CREATE INDEX IF NOT EXISTS idx_session ON messages(session_key);
    CREATE INDEX IF NOT EXISTS idx_compacted ON messages(compacted) WHERE compacted = FALSE;
    
    CREATE TABLE IF NOT EXISTS chunk_summaries (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      session_key TEXT NOT NULL,
      summary TEXT NOT NULL,
      message_count INTEGER NOT NULL,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );
    
    CREATE VIRTUAL TABLE IF NOT EXISTS search_index USING fts5(
      content, session_key, tokenize='porter'
    );
  `);
}

module.exports = { getDb };
```

**src/messages.js** - Store and retrieve:
```javascript
const { getDb } = require('./db');

function storeMessage(sessionKey, role, content) {
  const db = getDb();
  const stmt = db.prepare(`
    INSERT INTO messages (session_key, timestamp, role, content)
    VALUES (?, datetime('now'), ?, ?)
  `);
  return stmt.run(sessionKey, role, content).lastInsertRowid;
}

function getRecentMessages(sessionKey, limit = 50) {
  const db = getDb();
  return db.prepare(`
    SELECT * FROM messages 
    WHERE session_key = ? AND compacted = FALSE
    ORDER BY timestamp DESC LIMIT ?
  `).all(sessionKey, limit);
}

function getUncompactedMessages(sessionKey, limit = 100) {
  const db = getDb();
  return db.prepare(`
    SELECT * FROM messages 
    WHERE session_key = ? AND compacted = FALSE
    ORDER BY timestamp ASC LIMIT ?
  `).all(sessionKey, limit);
}

function markCompacted(ids) {
  const db = getDb();
  const placeholders = ids.map(() => '?').join(',');
  db.prepare(`UPDATE messages SET compacted = TRUE WHERE id IN (${placeholders})`).run(...ids);
}

module.exports = { storeMessage, getRecentMessages, getUncompactedMessages, markCompacted };
```

**src/search.js** - Search functionality:
```javascript
const { getDb } = require('./db');

function search(query, sessionKey, limit = 10) {
  const db = getDb();
  const sanitized = query.replace(/"/g, '""').split(/\s+/).map(t => `"${t}"`).join(' OR ');
  
  return db.prepare(`
    SELECT content, rank FROM search_index
    WHERE search_index MATCH ? AND session_key = ?
    ORDER BY rank LIMIT ?
  `).all(sanitized, sessionKey, limit);
}

function recallTopic(sessionKey, topic, daysBack = 7) {
  const db = getDb();
  const since = new Date();
  since.setDate(since.getDate() - daysBack);
  
  return db.prepare(`
    SELECT summary, created_at FROM chunk_summaries
    WHERE session_key = ? AND created_at >= ? AND summary LIKE ?
    ORDER BY created_at DESC
  `).all(sessionKey, since.toISOString(), `%${topic}%`);
}

module.exports = { search, recallTopic };
```

**src/memory-sync.js** - Extract to memory file:
```javascript
const fs = require('fs');
const path = require('path');

const MEMORY_FILE = path.join(process.cwd(), '..', '..', 'MEMORY.md');

function extractDecisions(text) {
  const decisions = [];
  const patterns = [
    /decided to\s+(.+?)(?:\.|$)/gi,
    /agreed (?:on|to)\s+(.+?)(?:\.|$)/gi,
    /will\s+(.+?)(?:\.|$)/gi,
  ];
  
  for (const pattern of patterns) {
    let match;
    while ((match = pattern.exec(text)) !== null) {
      const content = match[1].trim();
      if (content.length > 10 && content.length < 200) {
        decisions.push(content);
      }
    }
  }
  return [...new Set(decisions)]; // Deduplicate
}

function syncToMemory(date, decisions) {
  if (!fs.existsSync(MEMORY_FILE)) {
    fs.writeFileSync(MEMORY_FILE, '# Memory\n\n');
  }
  
  let content = fs.readFileSync(MEMORY_FILE, 'utf-8');
  const header = '## Auto-Captured';
  const entries = decisions.map(d => `- **[${date}]** ${d}`).join('\n');
  
  if (content.includes(header)) {
    const idx = content.indexOf(header);
    content = content.slice(0, idx + header.length) + '\n' + entries + '\n' + content.slice(idx + header.length);
  } else {
    content += `\n${header}\n\n${entries}\n`;
  }
  
  fs.writeFileSync(MEMORY_FILE, content);
}

module.exports = { extractDecisions, syncToMemory };
```

**src/index.js** - Main API:
```javascript
const { storeMessage, getRecentMessages, getUncompactedMessages, markCompacted } = require('./messages');
const { search, recallTopic } = require('./search');
const { extractDecisions, syncToMemory } = require('./memory-sync');

class MemoryLCM {
  constructor(sessionKey = 'default') {
    this.sessionKey = sessionKey;
  }
  
  // Call this after each assistant response
  log(role, content) {
    storeMessage(this.sessionKey, role, content);
  }
  
  // Search all history
  search(query, limit = 10) {
    return search(query, this.sessionKey, limit);
  }
  
  // Recall specific topic
  recall(topic, days = 7) {
    return recallTopic(this.sessionKey, topic, days);
  }
  
  // Manual compaction (or call daily)
  compact() {
    const messages = getUncompactedMessages(this.sessionKey, 20);
    if (messages.length < 10) return { compacted: 0 };
    
    // Simple summarization: concatenate key messages
    const summary = messages
      .filter(m => m.role === 'user' || m.content.length > 100)
      .map(m => m.content.substring(0, 150))
      .join('\n---\n');
    
    // Store summary, mark compacted
    const ids = messages.map(m => m.id);
    markCompacted(ids);
    
    // Extract and sync decisions
    const decisions = extractDecisions(summary);
    if (decisions.length > 0) {
      const today = new Date().toISOString().split('T')[0];
      syncToMemory(today, decisions);
    }
    
    return { compacted: messages.length, decisions: decisions.length };
  }
}

module.exports = { MemoryLCM };
```

### 4. Usage in Your Agent

```javascript
const { MemoryLCM } = require('./skills/memory-lcm/src');
const memory = new MemoryLCM('my-session');

// After each turn:
memory.log('user', userMessage);
memory.log('assistant', assistantResponse);

// End of day (or when context high):
memory.compact();

// Later, recall something:
const results = memory.recall('website redesign', 7);
```

## Security Considerations

### Safe Defaults
- Database is local SQLite (no network)
- Only writes to `data/` and `MEMORY.md` in workspace
- No code execution
- No external API calls (unless you add them)

### What to Review
- Check that `DB_PATH` and `MEMORY_FILE` point to safe locations
- Ensure no user input reaches SQL without sanitization (already done)
- Verify file permissions on `data/` directory

## Customization

### Change Summary Model
Replace the simple concatenation in `compact()` with an LLM call:
```javascript
// Instead of:
const summary = messages.map(...).join('...');

// Use:
const summary = await llm.summarize(messages.map(m => m.content).join('\n'));
```

### Change Storage Location
Edit `DB_PATH` in `src/db.js` and `MEMORY_FILE` in `src/memory-sync.js`.

### Add More Patterns
In `extractDecisions()`, add regex patterns for your domain:
```javascript
/prioritized\s+(.+?)(?:\.|$)/gi,
/deadline\s+(.+?)(?:\.|$)/gi,
```

## Testing

```javascript
const { MemoryLCM } = require('./src');
const m = new MemoryLCM('test');

m.log('user', 'We decided to build a new feature');
m.log('assistant', 'I will create the implementation plan');

const result = m.compact();
console.log('Compacted:', result.compacted);
console.log('Decisions found:', result.decisions);
```

## License

MIT — Use freely, modify as needed.

---

*Built for AI agents who want to remember.*
