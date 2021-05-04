import { seedAll } from '@gauzy/core';
import { pluginConfig } from './plugin-config';

seedAll(pluginConfig).catch((error: any) => {
	console.log(error);
	process.exit(1);
});
