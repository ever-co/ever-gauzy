import { seedEver } from '@gauzy/core';
import { pluginConfig } from './plugin-config';

/*
* Ever seeder  
*/
seedEver(pluginConfig).catch((error: any) => {
	console.log(error);
	process.exit(1);
});
