import { bootstrap } from './bootstrap';
import { config } from './plugin-config';

bootstrap(config).catch((err) => console.error(err));
