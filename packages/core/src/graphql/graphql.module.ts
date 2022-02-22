import { DynamicModule, Module } from '@nestjs/common';
import { GraphQLModule, GraphQLTypesLoader } from '@nestjs/graphql';
import { IGraphQLApiOptions } from '@gauzy/common';
import { ConfigService } from '@gauzy/config';
import { createGraphqlModuleOptions } from './graphql-helper';
import { ApolloDriver, ApolloDriverConfig } from '@nestjs/apollo';

@Module({})
export class GraphqlModule {
	static registerAsync(
		options: (configService: ConfigService) => IGraphQLApiOptions
	): DynamicModule {
		return GraphQLModule.forRootAsync<ApolloDriverConfig>({
			driver: ApolloDriver,
			useFactory: async (
				configService: ConfigService,
				typesLoader: GraphQLTypesLoader
			) => {
				return createGraphqlModuleOptions(
					configService,
					typesLoader,
					options(configService)
				);
			},
			inject: [ConfigService, GraphQLTypesLoader],
			imports: []
		}) as DynamicModule;
	}
}
