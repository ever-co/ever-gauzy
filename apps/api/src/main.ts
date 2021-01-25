import { bootstrap } from '@gauzy/core';

import { pluginConfig } from './plugin-config';
console.log(pluginConfig);

bootstrap(pluginConfig).catch((error) => {
	console.log(error);
	process.exit(1);
});
