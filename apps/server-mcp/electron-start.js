import { spawn } from 'node:child_process';
import path from 'node:path';
import fs from 'node:fs';

// Path to the built electron-main.js file
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Read project configuration to construct correct path
const projectJsonPath = path.join(__dirname, 'project.json');
let outputPath = 'dist/apps/server-mcp'; // default fallback
let mainFilename = 'main.js'; // default fallback

try {
  const projectJson = JSON.parse(fs.readFileSync(projectJsonPath, 'utf8'));
  outputPath = projectJson.targets?.build?.options?.outputPath || outputPath;
} catch (error) {
  console.warn('⚠️ Could not read project.json, using default path:', error.message);
}

const electronMainPath = path.join(__dirname, '../../', outputPath, mainFilename);

// Check if the electron main file exists
if (!fs.existsSync(electronMainPath)) {
  console.error('❌ Electron main file not found at:', electronMainPath);
  console.error('📁 Resolved from outputPath:', outputPath);
  console.error('📄 Expected filename:', mainFilename);
  console.error('🔧 Please build the project first with: yarn nx build server-mcp');
  console.error('💡 Or check if the build configuration in project.json is correct');
  throw new Error(`Electron main file not found: ${electronMainPath}`);
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
