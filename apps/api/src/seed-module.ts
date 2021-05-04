import { seedModule } from '@gauzy/core';
import { pluginConfig } from './plugin-config';

seedModule(pluginConfig).catch((error: any) => {
	console.log(error);
	process.exit(1);
});
