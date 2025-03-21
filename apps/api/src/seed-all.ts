import { Logger } from '@nestjs/common';
import { seedAll } from '@gauzy/core';
import { pluginConfig } from './plugin-config';

const logger = new Logger('GZY - SeedAll');

seedAll(pluginConfig).catch((error) => {
	logger.error(`Error seeding all data: ${error}`);
	process.exit(1);
});
