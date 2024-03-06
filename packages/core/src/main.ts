console.log('Core Starting...');

import { bootstrap } from './bootstrap';
console.log('Core Bootstrap loaded');

import { devConfig } from './dev-config';
console.log('Core Dev Config loaded');

bootstrap(devConfig)
	.then(() => {
		console.log('Core is running');
	})
	.catch(async (error) => {
		console.error(error);
		process.exit(1);
	});
