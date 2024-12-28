import * as path from 'path';
import * as fs from 'fs';
import * as dotenv from 'dotenv';

console.time('✔ Total API Startup Time');

const currentWorkingDirectory = process.cwd();
console.log('Current Working Directory: ->', currentWorkingDirectory);

// Define paths for .env and .env.local
const envPaths = ['.env', '.env.local'];

const envPath = path.resolve(currentWorkingDirectory, envPaths[0]);
const envLocalPath = path.resolve(currentWorkingDirectory, envPaths[1]);

console.log(`Using .env Path: ${envPath} and .env.local Path: ${envLocalPath}`);

// Load .env file first
console.time('✔ Load .env Time');
if (fs.existsSync(envPath)) {
    console.log(`Loading environment variables from: ${envPath}`);
    dotenv.config({ path: envPath, override: true });
}
console.timeEnd('✔ Load .env Time');

// Load .env.local without overriding existing variables
console.time('✔ Load .env.local Time');
if (fs.existsSync(envLocalPath)) {
    console.log(`Loading environment variables from: ${envLocalPath} (no override)`);
    dotenv.config({ path: envLocalPath });
}
console.timeEnd('✔ Load .env.local Time');

// Import bootstrap
console.time('✔ Bootstrap Import Time');
import { bootstrap } from './bootstrap';
console.timeEnd('✔ Bootstrap Import Time');
console.log('API Core Bootstrap Loaded');

// Import dev-config
console.time('✔ Dev Config Import Time');
import { devConfig } from './dev-config';
console.timeEnd('✔ Dev Config Import Time');
console.log('API Core Dev Config Loaded');

(async () => {
    try {
        console.log('API Core Starting...');
        console.time('✔ Bootstrap Execution Time');
        await bootstrap(devConfig);
        console.timeEnd('✔ Bootstrap Execution Time');
        console.log('API Core is running...');
    } catch (error) {
        console.error('Error during API Core startup:', error);
        console.timeEnd('✔ Total API Startup Time'); // Ensure time logging ends even on failure
        process.exit(1); // Exit the process with a failure code
    }

    console.timeEnd('✔ Total API Startup Time');
})();
