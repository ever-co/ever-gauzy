console.log('API Core Starting...');

import * as path from 'path';

const currentWorkingDirectory = process.cwd();
console.log('Current Working Directory:', currentWorkingDirectory);

const envPaths = ['../../.env', '../../.env.local'];

const envPath = path.resolve(currentWorkingDirectory, envPaths[0]);
const envLocalPath = path.resolve(currentWorkingDirectory, envPaths[1]);

console.log(`Using .env Path: ${envPath} or .env.local Path: ${envLocalPath}`);

import * as dotenv from 'dotenv';
dotenv.config({ path: envPaths });

import { bootstrap } from './bootstrap';
console.log('API Core Bootstrap loaded');

import { devConfig } from './dev-config';
console.log('API Core Dev Config loaded');

bootstrap(devConfig)
	.then(() => {
		console.log('API Core is running');
	})
	.catch(async (error) => {
		console.error(error);
		process.exit(1);
	});
