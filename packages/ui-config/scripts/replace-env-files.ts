import * as path from 'path';
import * as fs from 'fs';

/**
 * Replaces the environment.ts file with environment.prod.ts if the environment is set to production.
 * This ensures that the production build uses the correct environment configuration.
 */
function replaceEnvironmentFiles(): void {
	const env = process.env['NODE_ENV'] || 'development';
	const environmentsDir = path.resolve(__dirname, '../src/lib/environments');
	const sourceFile = path.join(environmentsDir, 'environment.prod.ts');
	const targetFile = path.join(environmentsDir, 'environment.ts');

	console.log(`Environment file replacement - NODE_ENV: ${env}`);
	console.log(`Environments directory: ${environmentsDir}`);

	if (env !== 'production') {
		console.log('Development build detected. No file replacement necessary.');
		return;
	}

	console.log('Production build detected. Replacing environment files...');

	// Validate source file exists
	if (!fs.existsSync(sourceFile)) {
		console.error(`✗ Source file does not exist: ${sourceFile}`);
		console.error(`Please ensure the configure.ts script has run successfully before this step.`);
		process.exit(1);
	}

	// Validate target directory exists
	if (!fs.existsSync(environmentsDir)) {
		console.error(`✗ Environments directory does not exist: ${environmentsDir}`);
		console.error(`Please ensure the configure.ts script has created the directory.`);
		process.exit(1);
	}

	try {
		// Copy production environment file to environment.ts
		fs.copyFileSync(sourceFile, targetFile);
		console.log(`✓ Successfully replaced ${path.basename(targetFile)} with ${path.basename(sourceFile)}`);
		console.log(`  Source: ${sourceFile}`);
		console.log(`  Target: ${targetFile}`);
	} catch (error) {
		const errorMessage = error instanceof Error ? error.message : String(error);
		console.error(`✗ Failed to copy environment file: ${errorMessage}`);
		console.error(`  Source: ${sourceFile}`);
		console.error(`  Target: ${targetFile}`);
		process.exit(1);
	}
}

// Replace environment files for production build
replaceEnvironmentFiles();
