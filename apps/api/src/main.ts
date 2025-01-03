import * as chalk from 'chalk';
import { loadEnv } from './load-env';

// Load environment variables
console.log('Loading Environment Variables...');
loadEnv();
console.log('Environment Variables Loaded');

// Start measuring the overall API startup time
console.time(chalk.green(`✔ Total API Startup Time`));

console.log(chalk.green(`✔ API Starting...`));
console.time(chalk.green(`✔ API Running`));

console.log('Bootstrap Loading...');
console.time('Bootstrap Time');
import { bootstrap } from '@gauzy/core';
console.timeEnd('Bootstrap Time');
console.log('Bootstrap Loaded');

console.log('Plugin Config Loading...');
console.time('Plugin Config Time');
import { pluginConfig } from './plugin-config';
console.timeEnd('Plugin Config Time');
console.log('Plugin Config Loaded');

bootstrap(pluginConfig)
	.then(() => {
		console.timeEnd(chalk.green(`✔ API Running`));
		console.timeEnd(chalk.green(`✔ Total API Startup Time`));
	})
	.catch(async (error) => {
		console.log(error);
		console.timeEnd(chalk.green(`✔ Total API Startup Time`));
		process.exit(1);
	});
