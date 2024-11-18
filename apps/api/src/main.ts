console.log('API Starting...');

import { bootstrap } from '@gauzy/core';
console.log('Bootstrap loaded');

import { pluginConfig } from './plugin-config';

bootstrap(pluginConfig)
	.then(() => {
		console.log('API is running');
	})
	.catch(async (error) => {
		console.log(error);
		process.exit(1);
	});
