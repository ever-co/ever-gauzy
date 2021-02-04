import { seedDefault } from '@gauzy/core';
import { pluginConfig } from './plugin-config';

seedDefault(pluginConfig).catch((error) => {
	console.log(error);
	process.exit(1);
});
