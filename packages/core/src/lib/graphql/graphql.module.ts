import { DynamicModule, Module } from '@nestjs/common';
import { GraphQLModule, GraphQLTypesLoader } from '@nestjs/graphql';
import { ApolloDriver, ApolloDriverConfig } from '@nestjs/apollo';
import { GraphQLApiConfigurationOptions } from '@gauzy/common';
import { ConfigService } from '@gauzy/config';
import { createGraphqlModuleOptions } from './graphql-helper';

@Module({})
export class GraphqlModule {
	/**
	 * Register GraphQL module asynchronously.
	 * @param optionsFactory Factory function to provide GraphQL configuration options.
	 * @returns Dynamic module configuration.
	 */
	static registerAsync(
		optionsFactory: (configService: ConfigService) => GraphQLApiConfigurationOptions
	): DynamicModule {
		return GraphQLModule.forRootAsync<ApolloDriverConfig>({
			driver: ApolloDriver,
			useFactory: async (configService: ConfigService, typesLoader: GraphQLTypesLoader) => {
				return createGraphqlModuleOptions(configService, typesLoader, optionsFactory(configService));
			},
			inject: [ConfigService, GraphQLTypesLoader],
			imports: []
		});
	}
}
