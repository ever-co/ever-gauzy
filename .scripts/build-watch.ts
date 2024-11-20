import { exec } from 'child_process';

/**
 * This script is used to build a library and watch for changes.
 * It takes a single argument, which is the name of the library to build.
 */
function runBuildWatch() {
	const args = process.argv.slice(2); // Get the library name from the command-line arguments
	const libName = args[0];

	if (!libName) {
		console.error('Error: Library name is required. Usage: yarn build:watch <library-name>');
		process.exit(1);
	}

	const command = `yarn nx build ${libName} --watch`;
	console.log(`Running command: ${command}`);

	const child = exec(command);

	child.stdout?.on('data', (data) => {
		console.log(data.toString());
	});

	child.stderr?.on('data', (data) => {
		console.error(data.toString());
	});

	child.on('close', (code) => {
		console.log(`Child process exited with code ${code}`);
	});
}

// Run the build-watch script
runBuildWatch();
