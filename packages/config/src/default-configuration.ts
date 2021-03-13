require('dotenv').config();

import {
	DEFAULT_API_HOST,
	DEFAULT_API_PORT,
	DEFAULT_API_BASE_URL,
	DEFAULT_GRAPHQL_API_PATH,
	IPluginConfig
} from '@gauzy/common';
import * as path from 'path';
import { dbConnectionConfig } from './database';

/**
 * The default configurations.
 */
export const defaultConfiguration: IPluginConfig = {
	apiConfigOptions: {
		host: process.env.HOST || DEFAULT_API_HOST,
		port: process.env.PORT || DEFAULT_API_PORT,
		baseUrl: process.env.API_BASE_URL || DEFAULT_API_BASE_URL,
		middleware: [],
		graphqlConfigOptions: {
			path: DEFAULT_GRAPHQL_API_PATH,
			playground: true,
			debug: true,
			apolloServerPlugins: []
		}
	},
	dbConnectionOptions: {
		...dbConnectionConfig
	},
	plugins: [],
	authOptions: {
		expressSessionSecret: 'gauzy',
		userPasswordBcryptSaltRounds: 12,
		jwtSecret: 'secretKey'
	},
	assetOptions: {
		assetPath: path.join(
			path.resolve(
				__dirname,
				'../../../',
				...['apps', 'api', 'src', 'assets']
			)
		),
		assetPublicPath: path.join(
			path.resolve(__dirname, '../../../', ...['apps', 'api', 'public'])
		)
	}
};
