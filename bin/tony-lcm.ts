#!/usr/bin/env node
import { getLCM } from '../src/index.js';

const command = process.argv[2];
const args = process.argv.slice(3);

const sessionKey = process.env.SESSION_KEY || 'default';
const lcm = getLCM(sessionKey);

async function main() {
  switch (command) {
    case 'status':
      const status = lcm.status();
      console.log(JSON.stringify(status, null, 2));
      break;
      
    case 'compact':
      const force = args.includes('--force');
      const result = await lcm.compact(force);
      console.log(result.message);
      break;
      
    case 'search':
      const query = args.join(' ');
      if (!query) {
        console.error('Usage: tony-lcm search <query>');
        process.exit(1);
      }
      const results = lcm.search(query);
      console.log(JSON.stringify(results, null, 2));
      break;
      
    case 'recall':
      const topic = args[0];
      const days = parseInt(args[1]) || 7;
      if (!topic) {
        console.error('Usage: tony-lcm recall <topic> [days]');
        process.exit(1);
      }
      const recalled = lcm.recall(topic, days);
      console.log(JSON.stringify(recalled, null, 2));
      break;
      
    case 'daily':
      const date = args[0];
      const success = await lcm.dailyRollup(date);
      console.log(success ? 'Daily summary created' : 'No chunks to summarize');
      break;
      
    case 'sync':
      const syncDate = args[0];
      const synced = lcm.syncToMemory(syncDate);
      console.log(`Synced ${synced} entries to MEMORY.md`);
      break;
      
    default:
      console.log(`
Tony Spark LCM - Lossless Context Manager

Usage:
  tony-lcm status              Show current status
  tony-lcm compact [--force]   Compact messages into summaries
  tony-lcm search <query>      Search across all stored content
  tony-lcm recall <topic>      Recall discussions on a topic
  tony-lcm daily [date]        Generate daily summary
  tony-lcm sync [date]         Sync key decisions to MEMORY.md

Environment:
  SESSION_KEY    Session identifier (default: 'default')
`);
  }
}

main().catch(console.error);
