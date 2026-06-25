import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ENTITIES_DIR = path.join(__dirname, '..', 'agent-os-dashboard', 'server', 'data', 'entities');

async function main() {
  const files = await fs.readdir(ENTITIES_DIR);
  console.log(`Found ${files.length} entity files.`);
  
  const matches = [];
  for (const file of files) {
    if (!file.endsWith('.json')) continue;
    try {
      const content = await fs.readFile(path.join(ENTITIES_DIR, file), 'utf-8');
      const entity = JSON.parse(content);
      
      const searchText = [
        entity.content || '',
        entity.summary || ''
      ].join(' ').toLowerCase();
      
      if (searchText.includes('review') || searchText.includes('principle') || searchText.includes('right') || searchText.includes('zen') || searchText.includes('earth') || searchText.includes('theme') || searchText.includes('palette') || searchText.includes('aesthetic')) {
        matches.push({
          id: entity.id,
          type: entity.type,
          agent: entity.agent,
          timestamp: new Date(entity.timestamp).toISOString(),
          summary: entity.summary,
          content: (entity.content || '').substring(0, 300)
        });
      }
    } catch(e) {}
  }
  
  matches.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
  console.log(`Found ${matches.length} matching entities.`);
  await fs.writeFile('scratch/matched_sessions.json', JSON.stringify(matches, null, 2));
}

main().catch(console.error);
