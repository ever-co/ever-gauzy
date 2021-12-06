import { bootstrap } from './bootstrap';
import { devConfig } from './dev-config';

bootstrap(devConfig).catch((error) => {
	console.log(error);
	process.exit(1);
});