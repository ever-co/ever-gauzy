import * as chalk from 'chalk';
console.log(chalk.green(`✔ API Starting...`));
console.time(chalk.green(`✔ API is running`));

import { bootstrap } from '@gauzy/core';
console.log('Bootstrap loaded');

import { pluginConfig } from './plugin-config';
console.log('Plugin Config loaded');

bootstrap(pluginConfig)
	.then(() => {
		console.timeEnd(chalk.green(`✔ API is running`));
	})
	.catch(async (error) => {
		console.log(error);
		process.exit(1);
	});
