import { seedBasic } from '@gauzy/core';
import { pluginConfig } from './plugin-config';

seedBasic(pluginConfig).catch((error) => {
	console.log(error);
	process.exit(1);
});
