const { spawn, execSync } = require('child_process');
const path = require('path');
const fs = require('fs');
const net = require('net');

const rootDir = path.resolve(__dirname, '..');
const serverDir = path.join(rootDir, 'agent-os-dashboard', 'server');
const clientDir = path.join(rootDir, 'agent-os-dashboard', 'client');

// Colors helper using ANSI escape codes
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  cyan: '\x1b[36m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  dim: '\x1b[2m',
  magenta: '\x1b[35m'
};

function log(prefix, message, color = colors.reset) {
  const lines = message.toString().split('\n');
  for (const line of lines) {
    if (line.trim() || lines.length === 1) {
      console.log(`${color}${prefix}${colors.reset} ${line}`);
    }
  }
}

// Automatically install dependencies if node_modules is missing
function checkDependencies(dir, name) {
  const nodeModulesPath = path.join(dir, 'node_modules');
  if (!fs.existsSync(nodeModulesPath)) {
    console.log(`${colors.cyan}▸ npm install in ${name}...${colors.reset}`);
    try {
      execSync('npm install', { cwd: dir, stdio: 'inherit' });
      console.log(`${colors.green}✓ Dependencies installed for ${name}.${colors.reset}\n`);
    } catch (error) {
      console.error(`${colors.red}✗ Failed to install dependencies for ${name}: ${error.message}${colors.reset}`);
      process.exit(1);
    }
  }
}

// Check if a port is already in use
function checkPortInUse(port) {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.once('error', (err) => {
      resolve(err.code === 'EADDRINUSE');
    });
    server.once('listening', () => {
      server.close();
      resolve(false);
    });
    server.listen(port);
  });
}

async function main() {
  checkDependencies(serverDir, 'server');
  checkDependencies(clientDir, 'client');

  const serverPort = process.env.PORT || 3030;
  const serverRunning = await checkPortInUse(serverPort);

  console.log(`${colors.cyan}▸ Starting Memo-Ray...${colors.reset}`);
  if (serverRunning) {
    console.log(`${colors.yellow}⚠ Server port ${serverPort} is already in use. Assuming Memo-Ray server is already running.${colors.reset}`);
  } else {
    console.log(`${colors.dim}  Server -> http://localhost:${serverPort}${colors.reset}`);
  }
  console.log(`${colors.dim}  Client -> http://localhost:5175${colors.reset}\n`);

  const isWindows = process.platform === 'win32';
  const npmCmd = isWindows ? 'npm.cmd' : 'npm';

  let serverProcess = null;
  let exiting = false;

  function cleanExit(code) {
    if (exiting) return;
    exiting = true;
    console.log(`\n${colors.cyan}▸ Shutting down Memo-Ray...${colors.reset}`);
    
    if (serverProcess && !serverProcess.killed) {
      try {
        if (isWindows) {
          execSync(`taskkill /pid ${serverProcess.pid} /f /t`, { stdio: 'ignore' });
        } else {
          serverProcess.kill('SIGTERM');
        }
      } catch (e) {
        try { serverProcess.kill('SIGKILL'); } catch (_) {}
      }
    }
    
    if (clientProcess && !clientProcess.killed) {
      try {
        if (isWindows) {
          execSync(`taskkill /pid ${clientProcess.pid} /f /t`, { stdio: 'ignore' });
        } else {
          clientProcess.kill('SIGTERM');
        }
      } catch (e) {
        try { clientProcess.kill('SIGKILL'); } catch (_) {}
      }
    }

    process.exit(code || 0);
  }

  if (!serverRunning) {
    serverProcess = spawn('node', ['index.js'], {
      cwd: serverDir,
      shell: isWindows,
      env: { ...process.env, PORT: serverPort.toString() }
    });

    serverProcess.stdout.on('data', (data) => {
      log('[Server]', data, colors.green);
    });
    serverProcess.stderr.on('data', (data) => {
      log('[Server] [ERR]', data, colors.red);
    });

    serverProcess.on('exit', (code) => {
      if (!exiting) {
        console.log(`${colors.red}✗ Server process exited with code ${code}${colors.reset}`);
        cleanExit(code);
      }
    });
  }

  // Spawn Client
  const clientProcess = spawn(npmCmd, ['run', 'dev'], {
    cwd: clientDir,
    shell: isWindows
  });

  clientProcess.stdout.on('data', (data) => {
    log('[Client]', data, colors.magenta);
  });
  clientProcess.stderr.on('data', (data) => {
    log('[Client] [ERR]', data, colors.red);
  });

  clientProcess.on('exit', (code) => {
    if (!exiting) {
      console.log(`${colors.red}✗ Client process exited with code ${code}${colors.reset}`);
      cleanExit(code);
    }
  });

  process.on('SIGINT', () => cleanExit(0));
  process.on('SIGTERM', () => cleanExit(0));
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
