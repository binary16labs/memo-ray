const fs = require('fs');
const path = require('path');

const MEDIA_PACK_DIR = __dirname;
const PROJECT_ROOT = path.resolve(MEDIA_PACK_DIR, '..');
const DIST_DIR = path.join(PROJECT_ROOT, 'dist');

// Create dist directory if it doesn't exist
if (!fs.existsSync(DIST_DIR)) {
  fs.mkdirSync(DIST_DIR, { recursive: true });
}

console.log('Building Promo Pack for GitHub Pages...');

// 1. Copy mcp_benchmark_results.js
const resultsSrc = path.join(PROJECT_ROOT, 'scratch', 'mcp_benchmark_results.js');
const resultsDest = path.join(DIST_DIR, 'mcp_benchmark_results.js');
if (fs.existsSync(resultsSrc)) {
  fs.copyFileSync(resultsSrc, resultsDest);
  console.log('✅ Copied mcp_benchmark_results.js');
} else {
  console.error('❌ Could not find scratch/mcp_benchmark_results.js');
}

// 2. Copy graph-renderer.js
const rendererSrc = path.join(MEDIA_PACK_DIR, 'graph-renderer.js');
const rendererDest = path.join(DIST_DIR, 'graph-renderer.js');
if (fs.existsSync(rendererSrc)) {
  fs.copyFileSync(rendererSrc, rendererDest);
  console.log('✅ Copied graph-renderer.js');
} else {
  console.error('❌ Could not find media_pack/graph-renderer.js');
}

// 3. Process and Copy HTML
const htmlSrc = path.join(MEDIA_PACK_DIR, 'mcp_promo_pack.html');
const htmlDest = path.join(DIST_DIR, 'index.html');

if (fs.existsSync(htmlSrc)) {
  let htmlContent = fs.readFileSync(htmlSrc, 'utf8');
  
  // Replace the relative script path to point to the local directory
  htmlContent = htmlContent.replace(
    '<script src="../scratch/mcp_benchmark_results.js"></script>',
    '<script src="./mcp_benchmark_results.js"></script>'
  );

  fs.writeFileSync(htmlDest, htmlContent);
  console.log('✅ Processed and copied mcp_promo_pack.html to index.html');
} else {
  console.error('❌ Could not find media_pack/mcp_promo_pack.html');
}

console.log('Build complete! Ready for GitHub Pages deployment.');
