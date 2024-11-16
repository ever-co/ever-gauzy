console.log('API Starting...');

import { pluginConfig } from './plugin-config';
console.log('Plugin Config loaded', pluginConfig);

import { bootstrap } from '@gauzy/core';
console.log('Bootstrap loaded');

bootstrap(pluginConfig)
	.then(() => {
		console.log('API is running');
	})
	.catch(async (error) => {
		console.log(error);
		process.exit(1);
	});
