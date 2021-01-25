import { bootstrap } from '@gauzy/core';
import { pluginConfig } from './plugin-config';

bootstrap(pluginConfig)
	.then(() => {})
	.catch((error) => {
		console.log(error);
	});
