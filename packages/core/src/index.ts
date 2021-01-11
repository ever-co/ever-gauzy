import { bootstrap } from './bootstrap';
import { config } from './plugin-config';

export { bootstrap } from './bootstrap';
export * from './config/index';
export * from './logger/index';

bootstrap(config).catch((err) => console.error(err));
