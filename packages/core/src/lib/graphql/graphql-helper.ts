import { GqlModuleOptions, GraphQLTypesLoader } from '@nestjs/graphql';
import { ApolloDriver } from '@nestjs/apollo';
import { buildSchema, extendSchema, printSchema } from 'graphql';
import * as path from 'path';
import { GraphQLApiConfigurationOptions, isNotEmpty } from '@gauzy/utils';
import { ConfigService } from '@gauzy/config';
import { getPluginExtensions } from '@gauzy/plugin';

/**
 *
 * @param configService
 * @param typesLoader
 * @param options
 * @returns
 */
export async function createGraphqlModuleOptions(
	configService: ConfigService,
	typesLoader: GraphQLTypesLoader,
	options: GraphQLApiConfigurationOptions
): Promise<GqlModuleOptions> {
	return {
		driver: ApolloDriver,
		path: `/${options.path}`,
		typeDefs: await createTypeDefs(configService, options, typesLoader),
		playground: options.playground || false,
		debug: options.debug || false,
		cors: {
			origin: '*',
			credentials: true,
			methods: ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE', 'OPTIONS'].join(','),
			allowedHeaders: [
				'Authorization',
				'Language',
				'Tenant-Id',
				'Organization-Id',
				'X-Requested-With',
				'X-Auth-Token',
				'X-HTTP-Method-Override',
				'Content-Type',
				'Content-Language',
				'Accept',
				'Accept-Language',
				'Observe'
			].join(', ')
		},
		include: [options.resolverModule]
	} as GqlModuleOptions;
}

/**
 *
 * @param configService
 * @param options
 * @param typesLoader
 * @returns
 */
async function createTypeDefs(
	configService: ConfigService,
	options: GraphQLApiConfigurationOptions,
	typesLoader: GraphQLTypesLoader
): Promise<string> {
	const normalizedPaths = options.typePaths.map((p) => p.split(path.sep).join('/'));
	const typeDefs = await typesLoader.mergeTypesByPaths(normalizedPaths);
	let schema = buildSchema(typeDefs);

	getPluginExtensions(configService.plugins)
		.map((e) => (typeof e.schema === 'function' ? e.schema() : e.schema))
		.filter(isNotEmpty)
		.forEach((documentNode) => (schema = extendSchema(schema, documentNode)));

	return printSchema(schema);
}
