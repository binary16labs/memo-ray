import { DataReader } from '../mcp-server/data-reader.js';
import fs from 'fs/promises';

async function main() {
  const sessions = await DataReader.getRecentSessions(100);
  console.log(`Loaded ${sessions.length} sessions`);
  const data = sessions.map(s => ({
    id: s.id,
    timestamp: new Date(s.timestamp).toISOString(),
    agent: s.agent,
    summary: s.summary,
    content: s.content ? s.content.substring(0, 500) : '',
    metadata: s.metadata
  }));
  await fs.writeFile('scratch/session_summaries.json', JSON.stringify(data, null, 2));
  console.log('Saved to scratch/session_summaries.json');
}
main().catch(console.error);
