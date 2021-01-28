require('dotenv').config();

import {
	API_HOST,
	API_PORT,
	BASE_URL,
	GRAPHQL_API_PATH,
	IPluginConfig
} from '@gauzy/common';
import * as path from 'path';
import { dbConnectionConfig } from './database';

/**
 * The default configurations.
 */
export const defaultConfiguration: IPluginConfig = {
	apiConfigOptions: {
		hostname: API_HOST,
		port: API_PORT,
		baseUrl: BASE_URL,
		middleware: [],
		graphqlConfigOptions: {
			path: GRAPHQL_API_PATH,
			playground: true,
			debug: true,
			apolloServerPlugins: []
		}
	},
	dbConnectionOptions: dbConnectionConfig,
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
