# Tony Spark LCM

> **Lossless Context Manager for OpenClaw** — Remember everything without the complexity.

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

## What is this?

A lightweight, custom context management system that replaces OpenClaw's default sliding-window compaction with a **lossless, searchable memory system**.

**The Problem:** Default AI agents truncate old conversations. Important decisions, context, and details get lost.

**The Solution:** Store every message in SQLite, create smart summaries, and auto-extract key decisions to your memory file.

## Features

- ✅ **Lossless storage** — Every message persisted in SQLite
- ✅ **Smart summaries** — Chunk-level and daily rollups
- ✅ **Full-text search** — Find anything instantly with FTS5
- ✅ **Auto-sync** — Key decisions auto-append to MEMORY.md
- ✅ **Cost-conscious** — Batched summaries, skips trivial exchanges
- ✅ **Simple architecture** — Flat summary stack, not a complex DAG

## Quick Start

```bash
# Clone the repo
git clone https://github.com/marcorosso-collab/OpenClaw-lossless-context-manager-Tony-Spark-LCM-.git
cd OpenClaw-lossless-context-manager-Tony-Spark-LCM-

# Install dependencies
npm install

# Build
npm run build

# Check status
node dist/bin/tony-lcm.js status
```

## Usage

```bash
# Check LCM status
node dist/bin/tony-lcm.js status

# Search history
node dist/bin/tony-lcm.js search "Discord"

# Recall a topic
node dist/bin/tony-lcm.js recall "website redesign" 7

# Compact messages into summaries
node dist/bin/tony-lcm.js compact

# Generate daily summary and sync to MEMORY.md
node dist/bin/tony-lcm.js daily

# Manually sync decisions to MEMORY.md
node dist/bin/tony-lcm.js sync
```

## Architecture

```
Level 2: Daily Summaries (coarse-grained)
    ↓
Level 1: Chunk Summaries (medium-grained)
    ↓
Level 0: Raw Messages (recent, protected)
```

**Storage:** SQLite with FTS5 search index

## Configuration

Edit `src/config.ts`:

```typescript
{
  enabled: true,
  dbPath: "~/.openclaw/workspace/data/tony-lcm.db",
  contextThreshold: 0.75,  // Compact at 75% context
  freshTailCount: 32,      // Keep last 32 messages raw
  chunkSize: 15,           // 15 messages per chunk
  summaryModel: "anthropic/claude-3-haiku",
  autoSyncToMemory: true
}
```

## For Other AI Agents

Want to implement this in your own agent? See **[PORTABLE.md](./PORTABLE.md)** for a self-contained, copy-paste version.

## Security

- ✅ Local SQLite only (no network)
- ✅ Only writes to configured paths
- ✅ No code execution
- ✅ Fully auditable

## Differences from Lossless-Claw

| Feature | Lossless-Claw | Tony Spark LCM |
|---------|---------------|----------------|
| Architecture | Complex DAG | Flat stack |
| Complexity | High | Low |
| Memory integration | None | Auto-sync |
| Customization | Plugin config | Direct code |

## Status

✅ Core storage (SQLite)
✅ Message persistence
✅ Chunk & daily summaries
✅ Full-text search
✅ CLI tools
✅ MEMORY.md auto-sync
🔄 LLM integration (placeholder)
🔄 Auto-compaction triggers

## License

MIT — Use freely, modify as needed.

---

*Built for Marco by Tony Spark. Simple, reliable, cost-effective.*
