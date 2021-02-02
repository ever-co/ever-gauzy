import { seedJob } from '@gauzy/core';
import { pluginConfig } from './plugin-config';

seedJob(pluginConfig).catch((error) => {
	console.log(error);
	process.exit(1);
});
