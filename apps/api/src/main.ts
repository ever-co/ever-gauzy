// Load environment variables
import { loadEnv } from '@gauzy/config/src/lib/load-env';
loadEnv();

import { Logger } from '@nestjs/common';
import { TimeMetric } from '@gauzy/metrics';
const logger = new Logger('GZY - API');

// Start measuring the overall API startup time
const timer = new TimeMetric();
timer.start('api.startup');

// Bootstrap the API
timer.start('api.bootstrap');
import { bootstrap } from '@gauzy/core';
logger.log(`API bootstrapping took: ${timer.end('api.bootstrap')}`);

// Load plugin configuration
timer.start('api.pluginConfig');
import { pluginConfig } from './plugin-config';
logger.log(`Plugin Configuration took: ${timer.end('api.pluginConfig')}`);

// Start the API
bootstrap(pluginConfig)
	.then(() => {
		logger.log(`✅ API started successfully: ${timer.end('api.startup')}`);
	})
	.catch(async (error) => {
		logger.error(`❌ API failed to start: ${timer.end('api.startup')}, Error: ${error}`);
		process.exit(1);
	});
