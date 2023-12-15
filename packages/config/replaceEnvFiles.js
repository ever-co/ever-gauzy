const fs = require('fs');
const path = require('path');

function replaceFilesForProduction() {
	const env = process.env.NODE_ENV || 'development';

	console.log(`Current NODE_ENV: ${process.env.NODE_ENV}`);

	if (env === 'production') {
		const sourceFile = path.join(__dirname, 'src/environments', 'environment.prod.ts');
		const targetFile = path.join(__dirname, 'src/environments', 'environment.ts');

		fs.copyFileSync(sourceFile, targetFile);
		console.log(`Replaced environment file with ${sourceFile}`);
	} else {
		console.log('Development build, no file replacement necessary.');
	}
}

replaceFilesForProduction();
