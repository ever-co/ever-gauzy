import { ClassProvider, FactoryProvider } from '@nestjs/common';
import { AbstractGraphQLDriver, GraphQLTypesLoader } from '@nestjs/graphql';
import { MikroORM } from '@mikro-orm/core';
import { ConfigService } from '@gauzy/config';
import { createGraphqlModuleOptions } from './graphql-helper';
import { GraphqlModule } from './graphql.module';
import { MikroOrmAwareApolloDriver } from './subscriptions/subscription-filter-context';

jest.mock('./graphql-helper', () => ({ createGraphqlModuleOptions: jest.fn(async () => ({})) }));

/**
 * The GraphQL module hands the subscription socket the MikroORM instance, so that under DB_ORM=mikro-orm each socket
 * operation runs in a MikroORM context of its own: nothing else opens one for a WebSocket message. The instance is
 * injected optionally, so a wiring without it still boots, as it did. The driver evaluates each subscription filter on
 * a fork of its own.
 */
describe('GraphqlModule.registerAsync', () => {
	/** The provider the options are built by. */
	const optionsProvider = (): FactoryProvider => {
		const module = GraphqlModule.registerAsync(() => ({ path: 'graphql' }) as never);

		return (module.providers ?? []).find(
			(provider): provider is FactoryProvider => typeof (provider as FactoryProvider).useFactory === 'function'
		) as FactoryProvider;
	};

	afterEach(() => {
		jest.clearAllMocks();
	});

	it('injects the MikroORM instance optionally, beside the configuration and the types loader', () => {
		expect(optionsProvider().inject).toEqual([
			ConfigService,
			GraphQLTypesLoader,
			{ token: MikroORM, optional: true }
		]);
	});

	it('serves with the driver that evaluates each subscription filter on a fork of its own', () => {
		const module = GraphqlModule.registerAsync(() => ({ path: 'graphql' }) as never);
		const driver = (module.providers ?? []).find(
			(provider) => (provider as ClassProvider).provide === AbstractGraphQLDriver
		) as ClassProvider;

		expect(driver.useClass).toBe(MikroOrmAwareApolloDriver);
	});

	it('hands the instance to the options, and none when the wiring has none', async () => {
		const configService = {} as ConfigService;
		const typesLoader = {} as GraphQLTypesLoader;
		const orm = {} as MikroORM;
		const { useFactory } = optionsProvider();

		await useFactory(configService, typesLoader, orm);
		await useFactory(configService, typesLoader, undefined);

		expect(createGraphqlModuleOptions).toHaveBeenNthCalledWith(
			1,
			configService,
			typesLoader,
			{ path: 'graphql' },
			orm
		);
		expect(createGraphqlModuleOptions).toHaveBeenNthCalledWith(
			2,
			configService,
			typesLoader,
			{ path: 'graphql' },
			undefined
		);
	});
});
