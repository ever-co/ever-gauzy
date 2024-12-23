import * as path from 'path';
import * as fs from 'fs';

/**
 * Replaces the environment.ts file with environment.prod.ts if the environment is set to production.
 */
function replaceFilesForProduction() {
	console.log('Replacing environment files for production build...', process.env['NODE_ENV']);

	const env = process.env['NODE_ENV'] || 'development';
	console.log(`Current NODE_ENV: ${process.env['NODE_ENV']}`);

	if (env === 'production') {
		console.log('Replacing environment files for __dirname: ' + __dirname);
		const sourceFile = path.join(path.resolve(__dirname, '../src/lib/environments'), 'environment.prod.ts');
		const targetFile = path.join(path.resolve(__dirname, '../src/lib/environments'), 'environment.ts');

		fs.copyFileSync(sourceFile, targetFile);
		console.log(`Replaced environment file with ${sourceFile}`);
	} else {
		console.log('Development build, no file replacement necessary.');
	}
}

// Replace environment files for production build
replaceFilesForProduction();
