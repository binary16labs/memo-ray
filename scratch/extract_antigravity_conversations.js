import { DataReader } from '../mcp-server/data-reader.js';
import fs from 'fs/promises';

async function main() {
  const sessions = await DataReader.getRecentSessions(100, null, 'antigravity');
  console.log(`Found ${sessions.length} Antigravity sessions.`);
  
  let outputText = '';
  
  for (const session of sessions) {
    const timeline = await DataReader.getSessionTimeline(session.id);
    if (!timeline) continue;
    
    outputText += `========================================================================\n`;
    outputText += `SESSION ID: ${session.id}\n`;
    outputText += `TIMESTAMP: ${new Date(session.timestamp).toISOString()}\n`;
    outputText += `SUMMARY: ${session.summary || 'N/A'}\n`;
    outputText += `========================================================================\n\n`;
    
    for (const event of timeline) {
      outputText += `[${event.type.toUpperCase()}] (${event.agent || 'System'}) - ${new Date(event.timestamp).toISOString()}\n`;
      outputText += `------------------------------------------------------------------------\n`;
      outputText += `${event.content || ''}\n`;
      if (event.metadata && Object.keys(event.metadata).length > 0) {
        outputText += `Metadata: ${JSON.stringify(event.metadata, null, 2)}\n`;
      }
      outputText += `\n`;
    }
    outputText += `\n\n`;
  }
  
  await fs.writeFile('scratch/antigravity_history.txt', outputText);
  console.log('Saved formatted history to scratch/antigravity_history.txt');
}

main().catch(console.error);
