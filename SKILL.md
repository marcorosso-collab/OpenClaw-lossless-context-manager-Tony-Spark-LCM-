# Tony Spark LCM (Lossless Context Manager)

A lightweight, custom context management system for OpenClaw that preserves conversation history without the complexity of a full DAG.

**Status:** ✅ LIVE — Auto-sync to MEMORY.md enabled (2026-03-17)

## Core Philosophy

- **Simple over complex**: Flat summary stack, not a DAG
- **Integrated, not separate**: Works with existing MEMORY.md and daily logs
- **Cost-conscious**: Batched summaries, cheaper models, skip trivial exchanges
- **Transparent**: Easy to understand, debug, and modify

## Architecture

### Storage Layer (SQLite)

```
conversations/
  ├── messages/           # Raw messages (full history)
  ├── chunk_summaries/    # Level 1: Every N messages
  ├── daily_summaries/    # Level 2: End-of-day rollup
  └── search_index/       # FTS5 for fast grep
```

### Summary Stack

```
Level 2: Daily Summaries (coarse-grained)
    ↓
Level 1: Chunk Summaries (medium-grained)  
    ↓
Level 0: Raw Messages (recent, protected)
```

### Trigger Conditions

1. **Token threshold**: Context >= 75% of model limit
2. **Time-based**: Natural breakpoints (end of task, 30min idle)
3. **Explicit**: User says "summarize this" or "compact now"

### Cost Controls

- Use Haiku/GPT-4o-mini for summaries (10x cheaper)
- Batch 10-20 messages per summary call
- Skip summarization for:
  - Single-word responses ("yes", "ok", "thanks")
  - Heartbeat checks
  - System/tool messages

## Tools Provided

### `lcm_search(query)`
Search across all stored summaries and messages.
Returns: Relevant chunks with timestamps and confidence scores.

### `lcm_recall(topic, depth)`
Deep dive into a specific topic from history.
Returns: Condensed narrative of everything discussed on that topic.

### `lcm_status()`
Show current context state:
- Raw messages in current window
- Summaries available
- Storage size
- Last compaction time

### `lcm_compact(force=false)`
Manually trigger compaction.

## Integration Points

### With MEMORY.md
- Auto-extract key decisions from daily summaries
- Append to MEMORY.md under appropriate sections
- Mark as "auto-captured from LCM"

### With Daily Logs
- Daily summaries append to `memory/YYYY-MM-DD.md`
- Cross-reference: "See also LCM daily summary for details"

### With Heartbeats
- LCM status check included in heartbeat
- Auto-compact if threshold exceeded

## File Structure

```
workspace/
├── skills/
│   └── tony-lcm/
│       ├── SKILL.md              # This file
│       ├── src/
│       │   ├── db.ts             # SQLite operations
│       │   ├── summarizer.ts     # Summary generation
│       │   ├── assembler.ts      # Context assembly
│       │   ├── search.ts         # Search/recall tools
│       │   └── triggers.ts       # Compaction triggers
│       ├── tools/
│       │   ├── lcm-search.ts
│       │   ├── lcm-recall.ts
│       │   ├── lcm-status.ts
│       │   └── lcm-compact.ts
│       └── package.json
└── data/
    └── tony-lcm.db               # SQLite database
```

## Configuration

```json
{
  "lcm": {
    "enabled": true,
    "dbPath": "~/.openclaw/workspace/data/tony-lcm.db",
    "contextThreshold": 0.75,
    "freshTailCount": 32,
    "chunkSize": 15,
    "summaryModel": "anthropic/claude-3-haiku",
    "autoSyncToMemory": true
  }
}
```

## Usage Examples

```
User: "What did we decide about the website redesign last week?"
→ lcm_recall("website redesign", depth="week")

User: "Search for all mentions of 'Discord'"
→ lcm_search("Discord")

User: "How much context are we using?"
→ lcm_status()

User: "Compact now"
→ lcm_compact(force=true)
```

## Implementation Phases

### Phase 1: Core Storage (Today)
- SQLite schema
- Message persistence
- Basic compaction

### Phase 2: Summarization (Next)
- Chunk summaries
- Daily rollups
- Cost tracking

### Phase 3: Tools (After)
- Search/recall
- Status/compact
- Memory integration

## Success Metrics

- [ ] Can recall any conversation from past 30 days
- [ ] Search returns relevant results in <2 seconds
- [ ] Summarization costs <10% of main conversation costs
- [ ] Zero data loss (everything persisted)
- [ ] Easy to disable/enable without data loss

---

*Built for Marco. Simple, reliable, cost-effective.*
