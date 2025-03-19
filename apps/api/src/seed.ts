import { Logger } from '@nestjs/common';
import { seedDefault } from '@gauzy/core';
import { pluginConfig } from './plugin-config';

const logger = new Logger('GZY - SeedDefault');

seedDefault(pluginConfig).catch((error) => {
	logger.error(`Error seeding default data: ${error}`);
	process.exit(1);
});
