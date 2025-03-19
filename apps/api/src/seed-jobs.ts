import { Logger } from '@nestjs/common';
import { seedJob } from '@gauzy/core';
import { pluginConfig } from './plugin-config';

const logger = new Logger('GZY - SeedJob');

seedJob(pluginConfig).catch((error) => {
	logger.error(`Error seeding job data: ${error}`);
	process.exit(1);
});
