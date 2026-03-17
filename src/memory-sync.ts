import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join } from 'path';
import { getConfig } from './config.js';

export interface MemoryEntry {
  date: string;
  category: 'decision' | 'project' | 'preference' | 'insight';
  content: string;
  source: string; // e.g., "LCM daily summary"
}

const MEMORY_PATH = '/Users/openclaw/.openclaw/workspace/MEMORY.md';

export function syncToMemory(entry: MemoryEntry): boolean {
  if (!existsSync(MEMORY_PATH)) {
    console.error('MEMORY.md not found');
    return false;
  }

  let content = readFileSync(MEMORY_PATH, 'utf-8');
  
  // Find or create the Auto-Captured section
  const autoCapturedHeader = '## Auto-Captured from Conversations';
  const entryLine = `- **[${entry.date}]** (${entry.category}) ${entry.content}`;
  
  if (content.includes(autoCapturedHeader)) {
    // Add to existing section
    const sectionIndex = content.indexOf(autoCapturedHeader);
    const nextSectionIndex = content.indexOf('\n## ', sectionIndex + 1);
    const insertPosition = nextSectionIndex === -1 ? content.length : nextSectionIndex;
    
    content = content.slice(0, insertPosition) + entryLine + '\n' + content.slice(insertPosition);
  } else {
    // Create new section at the end
    content += `\n\n${autoCapturedHeader}\n\n${entryLine}\n`;
  }
  
  writeFileSync(MEMORY_PATH, content);
  return true;
}

export function extractKeyDecisions(summary: string, date: string): MemoryEntry[] {
  const entries: MemoryEntry[] = [];
  
  // Pattern matching for key decision indicators
  const decisionPatterns = [
    /decided to\s+(.+?)(?:\.|$)/gi,
    /agreed (?:on|to)\s+(.+?)(?:\.|$)/gi,
    /will\s+(.+?)(?:\.|$)/gi,
    /chosen?\s+(.+?)(?:\.|$)/gi,
    /opted (?:for|to)\s+(.+?)(?:\.|$)/gi,
    /building\s+(.+?)(?:\.|$)/gi,
    /created\s+(.+?)(?:\.|$)/gi,
    /set up\s+(.+?)(?:\.|$)/gi,
  ];
  
  for (const pattern of decisionPatterns) {
    let match;
    while ((match = pattern.exec(summary)) !== null) {
      const content = match[1].trim();
      if (content.length > 10 && content.length < 200) {
        entries.push({
          date,
          category: 'decision',
          content,
          source: 'LCM daily summary',
        });
      }
    }
  }
  
  // Deduplicate
  const seen = new Set<string>();
  return entries.filter(e => {
    if (seen.has(e.content)) return false;
    seen.add(e.content);
    return true;
  });
}

export function extractProjects(summary: string, date: string): MemoryEntry[] {
  const entries: MemoryEntry[] = [];
  
  // Look for project mentions
  const projectPatterns = [
    /(?:project|initiative|build|create)\s+([A-Z][a-zA-Z\s]+?)(?:\s+(?:for|to|with)|\.|$)/gi,
    /working on\s+(.+?)(?:\.|$)/gi,
  ];
  
  for (const pattern of projectPatterns) {
    let match;
    while ((match = pattern.exec(summary)) !== null) {
      const content = match[1].trim();
      if (content.length > 5 && content.length < 100) {
        entries.push({
          date,
          category: 'project',
          content,
          source: 'LCM daily summary',
        });
      }
    }
  }
  
  // Deduplicate
  const seen = new Set<string>();
  return entries.filter(e => {
    if (seen.has(e.content)) return false;
    seen.add(e.content);
    return true;
  });
}

export function syncSummariesToMemory(summaries: string[], date: string): number {
  const combinedText = summaries.join('\n');
  const decisions = extractKeyDecisions(combinedText, date);
  const projects = extractProjects(combinedText, date);
  
  let synced = 0;
  for (const entry of [...decisions, ...projects]) {
    if (syncToMemory(entry)) {
      synced++;
    }
  }
  
  return synced;
}
