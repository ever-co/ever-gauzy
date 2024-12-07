import { seedEver } from '@gauzy/core';
import { pluginConfig } from './plugin-config';

seedEver(pluginConfig).catch((error: any) => {
	console.log(error);
	process.exit(1);
});
