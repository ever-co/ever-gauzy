import * as path from 'node:path';
import * as fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
console.log('Running replace-envr.js script...', __dirname);

/**
 * Replaces the environment.ts file with environment.prod.ts if the environment is set to production.
 * Always operates within packages/ui-config/src/lib/environments directory.
 */
function replaceEnv() {
	console.log('Replacing environment files for production build...', process.env['NODE_ENV']);

	const env = process.env['NODE_ENV'] || 'development';
	console.log(`Current NODE_ENV: ${env}`);

	// Construct the environments directory path relative to this script
	const environmentsDir = path.resolve(__dirname, '../src/lib/environments');
	console.log(`Environments directory path: ${environmentsDir}`);

	// Validate the environments directory exists
	if (!fs.existsSync(environmentsDir)) {
		console.error(`ERROR: Environments directory not found at ${environmentsDir}`);
		process.exit(1);
	}

	const sourceFile = path.join(environmentsDir, 'environment.prod.ts');
	const targetFile = path.join(environmentsDir, 'environment.ts');

	// Validate source file exists
	if (!fs.existsSync(sourceFile)) {
		console.error(`ERROR: Source file not found at ${sourceFile}`);
		process.exit(1);
	}

	if (env === 'production') {
		try {
			console.log(`Copying ${sourceFile} to ${targetFile}`);
			fs.copyFileSync(sourceFile, targetFile);
			console.log(`✓ Successfully replaced environment file`);
		} catch (error) {
			console.error(`ERROR: Failed to copy environment file:`, error);
			process.exit(1);
		}
	} else {
		console.log('Development build, no file replacement necessary.');
	}
}

// Replace environment files for production build
replaceEnv();
