import * as path from 'path';
import * as fs from 'fs';

const currentWorkingDirectory = process.cwd();
console.log('Current Working Directory: ->', currentWorkingDirectory);

// Define paths for .env and .env.local
const envPaths = ['.env', '.env.local'];

const envPath = path.resolve(currentWorkingDirectory, envPaths[0]);
const envLocalPath = path.resolve(currentWorkingDirectory, envPaths[1]);

console.log(`Using .env Path: ${envPath} and .env.local Path: ${envLocalPath}`);

import * as dotenv from 'dotenv';

// Load .env file first
if (fs.existsSync(envPath)) {
    console.log(`Loading environment variables from: ${envPath}`);
    dotenv.config({ path: envPath, override: true });
}

// Load .env.local without overriding existing variables
if (fs.existsSync(envLocalPath)) {
    console.log(`Loading environment variables from: ${envLocalPath} (no override)`);
    dotenv.config({ path: envLocalPath });
}

import { bootstrap } from './bootstrap';
console.log('API Core Bootstrap Loaded');

import { devConfig } from './dev-config';
console.log('API Core Dev Config Loaded');

(async () => {
    try {
        console.log('API Core Starting...');
        await bootstrap(devConfig);
        console.log('API Core is running...');
    } catch (error) {
        console.error('Error during API Core startup:', error);
        process.exit(1); // Exit the process with a failure code
    }
})();
