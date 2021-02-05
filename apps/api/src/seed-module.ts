import { seedModule } from '@gauzy/core';
import { pluginConfig } from './plugin-config';

seedModule(pluginConfig).catch((error) => {
	console.log(error);
	process.exit(1);
});
