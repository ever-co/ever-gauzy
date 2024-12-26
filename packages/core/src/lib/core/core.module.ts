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
import { DatabaseModule } from '../database/database.module';

console.log(path.join(path.resolve(__dirname, '../**/', 'schema'), '*.gql'));
console.log(path.join(path.resolve(__dirname, '../../../../../../../data/'), '*.gql'));
console.log(environment.isElectron, 'Environment Is Electron');

@Module({
	imports: [
		DatabaseModule,
		GraphqlApiModule,
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
					'Observe'
				].join(', ')
			},
			typePaths: [
				environment.isElectron
					? path.join(path.resolve(__dirname, '../../../../../../../data/'), '*.gql')
					: path.join(path.resolve(__dirname, '../**/', 'schema'), '*.gql')
			],
			resolverModule: GraphqlApiModule
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
