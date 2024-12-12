import * as chalk from 'chalk';
console.log(chalk.green(`✔ API Starting...`));
console.time(chalk.green(`✔ API is running`));

console.log('Bootstrap Loading...');
import { bootstrap } from '@gauzy/core';
console.log('Bootstrap Loaded');

console.log('Plugin Config Loading...');
import { pluginConfig } from './plugin-config';
console.log('Plugin Config Loaded');

bootstrap(pluginConfig)
	.then(() => {
		console.timeEnd(chalk.green(`✔ API is running`));
	})
	.catch(async (error) => {
		console.log(error);
		process.exit(1);
	});
