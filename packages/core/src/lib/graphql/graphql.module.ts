import { DynamicModule, Module } from '@nestjs/common';
import { GraphQLModule, GraphQLTypesLoader } from '@nestjs/graphql';
import { ApolloDriver, ApolloDriverConfig } from '@nestjs/apollo';
import { MikroORM } from '@mikro-orm/core';
import { GraphQLApiConfigurationOptions } from '@gauzy/common';
import { ConfigService } from '@gauzy/config';
import { createGraphqlModuleOptions } from './graphql-helper';

@Module({})
export class GraphqlModule {
	/**
	 * Register GraphQL module asynchronously.
	 *
	 * The MikroORM instance is injected optionally — `@mikro-orm/nestjs` provides it globally under every DB_ORM, and a
	 * wiring without it still boots — and handed to the subscription socket, which under DB_ORM=mikro-orm opens a
	 * MikroORM context for each of its operations: nothing else opens one for a WebSocket message.
	 *
	 * @param optionsFactory Factory function to provide GraphQL configuration options.
	 * @returns Dynamic module configuration.
	 */
	static registerAsync(
		optionsFactory: (configService: ConfigService) => GraphQLApiConfigurationOptions
	): DynamicModule {
		return GraphQLModule.forRootAsync<ApolloDriverConfig>({
			driver: ApolloDriver,
			useFactory: async (configService: ConfigService, typesLoader: GraphQLTypesLoader, orm?: MikroORM) => {
				return createGraphqlModuleOptions(configService, typesLoader, optionsFactory(configService), orm);
			},
			inject: [ConfigService, GraphQLTypesLoader, { token: MikroORM, optional: true }],
			imports: []
		});
	}
}
