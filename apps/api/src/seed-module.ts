import { Logger } from '@nestjs/common';
import { seedModule } from '@gauzy/core';
import { pluginConfig } from './plugin-config';

const logger = new Logger('GZY - SeedModule');

seedModule(pluginConfig).catch((error) => {
	logger.error(`Error seeding module data: ${error}`);
	process.exit(1);
});
