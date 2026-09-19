// Copyright (c) 2019-2020 Ever Co. LTD

// Modified code from https://github.com/xmlking/ngx-starter-kit.
// Originally MIT Licensed
// - see https://github.com/xmlking/ngx-starter-kit/blob/develop/LICENSE
// - original code `Copyright (c) 2018 Sumanth Chinthagunta`;
import { DynamicModule, MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import * as path from 'path';
import { ConfigService, environment } from '@gauzy/config';
import { RequestContextMiddleware } from './context';
import { FileStorageModule } from './file-storage';
import { GraphqlModule } from '../graphql/graphql.module';
import { GraphqlApiModule } from '../graphql/graphql-api.module';
import { InvoiceModule } from '../invoice/invoice.module';
import { InvoiceItemModule } from '../invoice-item/invoice-item.module';
import { DatabaseModule } from '../database/database.module';

@Module({
	imports: [
		DatabaseModule,
		GraphqlApiModule.withPlugins(),
		GraphqlModule.registerAsync((configService: ConfigService) => ({
			path: configService.graphqlConfigOptions.path,
			playground: configService.graphqlConfigOptions.playground,
			debug: configService.graphqlConfigOptions.debug,
			cors: {
				origin: '*',
				credentials: true,
				methods: [
					'GET',
					'HEAD',
					'PUT',
					'PATCH',
					'POST',
					'DELETE',
					'OPTIONS'
				].join(','),
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
					'Observe',
					'X-APP-ID',
					'X-API-KEY',
					'X-Channel-Id',
					'Idempotency-Key',
					'If-Match'
				].join(', ')
			},
			typePaths: [
				environment.isElectron
					? path.join(path.resolve(__dirname, '../../../../../../../data/'), '*.gql')
					: path.join(path.resolve(__dirname, '../**/', 'schema'), '*.gql')
			],
			resolverModule: GraphqlApiModule,
			// The domains the host module cannot import, and therefore cannot host: the invoice modules
			// already sit in a service cycle with each other's neighbour, so they declare their resolvers
			// themselves and the endpoint scans them where they are. Naming them here is what binds them —
			// a module that declares a resolver and is never scanned answers null on every field it owns,
			// with no error anywhere in the schema or the log.
			additionalResolverModules: [InvoiceModule, InvoiceItemModule],
			// The deployment's own attach point and ceilings travel with the rest of the options. Every
			// key is optional: an installation that configures none gets an empty plugin array and the
			// platform's default limits, and the environment can override each of them.
			apolloServerPlugins: configService.graphqlConfigOptions.apolloServerPlugins,
			introspection: configService.graphqlConfigOptions.introspection,
			limits: {
				maxDepth: configService.graphqlConfigOptions.maxDepth,
				maxComplexity: configService.graphqlConfigOptions.maxComplexity,
				maxAliases: configService.graphqlConfigOptions.maxAliases,
				maxBatchSize: configService.graphqlConfigOptions.maxBatchSize
			}
		})) as DynamicModule,
		FileStorageModule
	],
	controllers: [],
	providers: []
})
export class CoreModule implements NestModule {
	/**
	 * Configures middleware for the application.
	 *
	 * This method applies the specified middleware to the application using the
	 * provided `MiddlewareConsumer`. In this case, the `RequestContextMiddleware`
	 * is applied to all routes in the application.
	 *
	 * @param consumer - The `MiddlewareConsumer` provided by NestJS, used to manage
	 * middleware configurations for the application.
	 */
	configure(consumer: MiddlewareConsumer): void {
		consumer.apply(RequestContextMiddleware).forRoutes('*');
	}
}
