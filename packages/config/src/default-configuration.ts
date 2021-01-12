require('dotenv').config();

import { PluginConfig } from '@gauzy/common';
// import { DefaultLogger } from '@gauzy/core/src/logger/default-logger';
import { dbConnectionConfig } from './database';

/**
 * The default configurations.
 */
export const defaultConfiguration: PluginConfig = {
	apiConfig: {
		hostname: '127.0.0.1',
		port: 3001,
		middleware: [],
		graphqlConfig: {
			path: 'graphql',
			playground: true,
			debug: true,
			apolloServerPlugins: []
		}
	},
	dbConnectionConfig,
	plugins: []
};
