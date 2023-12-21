import { bootstrap } from './bootstrap';
import { devConfig } from './dev-config';

bootstrap(devConfig).catch((error) => {
	console.error(error);
	process.exit(1);
});
