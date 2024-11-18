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

@Module({
	imports: [
		DatabaseModule,
		GraphqlApiModule,
		GraphqlModule.registerAsync((configService: ConfigService) => ({
			path: configService.graphqlConfigOptions.path,
			playground: configService.graphqlConfigOptions.playground,
			debug: configService.graphqlConfigOptions.debug,
			cors: {
				methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
				credentials: true,
				origin: '*',
				allowedHeaders:
					'Authorization, Language, Tenant-Id, Organization-Id, X-Requested-With, X-Auth-Token, X-HTTP-Method-Override, Content-Type, Content-Language, Accept, Accept-Language, Observe'
			},
			typePaths: [
				environment.isElectron
					? path.join(path.resolve(__dirname, '../../../../../../data/'), '*.gql')
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
	configure(consumer: MiddlewareConsumer) {
		consumer.apply(RequestContextMiddleware).forRoutes('*');
	}
}
