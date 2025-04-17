import { Logger } from '@nestjs/common';
import { seedEver } from '@gauzy/core';
import { pluginConfig } from './plugin-config';

const logger = new Logger('GZY - SeedDspot');

seedEver(pluginConfig).catch((error) => {
	logger.error(`Error seeding DSpot ERP data: ${error}`);
	process.exit(1);
});
