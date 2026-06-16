#!/usr/bin/env node
/**
 * AST Graph Generator using tree-sitter
 * 
 * This script generates AST visualization graphs for code files.
 * It can be used to create graph representations of your code structure.
 * 
 * Usage:
 *   node scripts/generate-ast-graph.js <file-path> [output-format]
 * 
 * Output formats: json, dot, mermaid (default: json)
 */

const fs = require('fs');
const path = require('path');

// Check for tree-sitter parsers
const parsers = {
  javascript: 'tree-sitter-javascript',
  typescript: 'tree-sitter-typescript',
  python: 'tree-sitter-python',
  go: 'tree-sitter-go',
  rust: 'tree-sitter-rust'
};

function detectLanguage(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  const langMap = {
    '.js': 'javascript',
    '.jsx': 'javascript',
    '.ts': 'typescript',
    '.tsx': 'typescript',
    '.py': 'python',
    '.go': 'go',
    '.rs': 'rust'
  };
  return langMap[ext] || null;
}

async function parseFile(filePath) {
  const language = detectLanguage(filePath);
  
  if (!language) {
    console.error(`Unsupported file type: ${path.extname(filePath)}`);
    console.log('Supported: .js, .jsx, .ts, .tsx, .py, .go, .rs');
    process.exit(1);
  }

  const parserName = parsers[language];
  
  try {
    const Parser = require('tree-sitter');
    const Language = require(parserName);
    
    const parser = new Parser();
    parser.setLanguage(Language);
    
    const code = fs.readFileSync(filePath, 'utf8');
    const tree = parser.parse(code);
    
    return { tree, language, code };
  } catch (err) {
    if (err.code === 'MODULE_NOT_FOUND' && err.message.includes('tree-sitter')) {
      console.error(`Parser not found: ${parserName}`);
      console.error(`Install with: npm install ${parserName}`);
      process.exit(1);
    }
    throw err;
  }
}

function extractNodes(node, depth = 0, parentId = null) {
  const nodes = [];
  const id = parentId ? `${parentId}-${node.type}` : node.type;
  
  nodes.push({
    id,
    type: node.type,
    depth,
    start: node.startPosition,
    end: node.endPosition,
    parentId
  });
  
  if (node.children) {
    for (const child of node.children) {
      nodes.push(...extractNodes(child, depth + 1, id));
    }
  }
  
  return nodes;
}

function buildLinks(nodes) {
  const links = [];
  
  for (const node of nodes) {
    if (node.parentId) {
      links.push({
        source: node.parentId,
        target: node.id
      });
    }
  }
  
  return links;
}

function toDotFormat(nodes, links, title = 'AST Graph') {
  let dot = 'digraph AST {\n';
  dot += '  rankdir=TB;\n';
  dot += '  node [shape=box, style=filled, fillcolor=lightblue];\n';
  dot += `  label="${title}";\n\n`;
  
  for (const node of nodes) {
    const label = node.type;
    dot += `  "${node.id}" [label="${label}"];\n`;
  }
  
  dot += '\n';
  
  for (const link of links) {
    dot += `  "${link.source}" -> "${link.target}";\n`;
  }
  
  dot += '}\n';
  return dot;
}

function toMermaid(nodes, links, title = 'AST') {
  let mermaid = 'graph TD\n';
  
  for (const node of nodes) {
    const label = node.type;
    mermaid += `  ${node.id}["${label}"]\n`;
  }
  
  for (const link of links) {
    mermaid += `  ${link.source} --> ${link.target}\n`;
  }
  
  return mermaid;
}

async function generateGraph(filePath, format = 'json') {
  console.log(`Parsing: ${filePath}`);
  
  const { tree, language, code } = await parseFile(filePath);
  
  const nodes = extractNodes(tree.rootNode);
  const links = buildLinks(nodes);
  
  const graphData = {
    title: `${path.basename(filePath)} AST`,
    language,
    lines: code.split('\n').length,
    nodes,
    links,
    stats: {
      totalNodes: nodes.length,
      totalLinks: links.length,
      maxDepth: Math.max(...nodes.map(n => n.depth))
    }
  };
  
  if (format === 'json') {
    console.log(JSON.stringify(graphData, null, 2));
  } else if (format === 'dot') {
    console.log(toDotFormat(nodes, links, graphData.title));
  } else if (format === 'mermaid') {
    console.log(toMermaid(nodes, links, graphData.title));
  } else {
    console.error(`Unknown format: ${format}`);
    process.exit(1);
  }
  
  return graphData;
}

// CLI
if (require.main === module) {
  const args = process.argv.slice(2);
  const filePath = args[0];
  const format = args[1] || 'json';
  
  if (!filePath) {
    console.error('Usage: node generate-ast-graph.js <file-path> [format]');
    console.error('Formats: json, dot, mermaid');
    process.exit(1);
  }
  
  generateGraph(filePath, format).catch(err => {
    console.error('Error:', err.message);
    process.exit(1);
  });
}

module.exports = { generateGraph, parseFile, extractNodes, buildLinks };