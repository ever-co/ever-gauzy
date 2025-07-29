import { spawn } from 'node:child_process';
import path from 'node:path';
import fs from 'node:fs';

// Path to the built electron-main.js file
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const electronMainPath = path.join(__dirname, '../../dist/apps/server-mcp/src/electron-main.js');

// Check if the electron main file exists
if (!fs.existsSync(electronMainPath)) {
  console.error('❌ Electron main file not found at:', electronMainPath);
  console.error('Please build the project first with: yarn nx build server-mcp');
  process.exit(1);
}

console.log('🚀 Starting Electron app...');
console.log('📁 Electron main file:', electronMainPath);

// Start Electron with the main file
const electronProcess = spawn('npx', ['electron', electronMainPath], {
  stdio: 'inherit',
  shell: true,
  env: {
    ...process.env,
    ELECTRON_IS_DEV: 'false'
  }
});

electronProcess.on('close', (code) => {
  console.log(`📄 Electron process exited with code ${code}`);
  process.exit(code);
});

electronProcess.on('error', (err) => {
  console.error('❌ Failed to start Electron:', err);
  console.error('Make sure electron is installed and the project is built properly');
  process.exit(1);
});

// Handle process termination
process.on('SIGINT', () => {
  console.log('🛑 Received SIGINT, shutting down gracefully...');
  if (electronProcess && !electronProcess.killed) {
    electronProcess.kill('SIGINT');
  }
});

process.on('SIGTERM', () => {
  console.log('🛑 Received SIGTERM, shutting down gracefully...');
  if (electronProcess && !electronProcess.killed) {
    electronProcess.kill('SIGTERM');
  }
});
