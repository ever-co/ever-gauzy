/**
 * The GraphQL twins of the email provider routes (`GET /inbox/providers`, `/inbox/provider-accounts*`): the SDL
 * composes onto the core root types (alone, and after the Inbox's own SDL), every root field it declares is bound to
 * its resolver method, the module provides the resolver and the plugin declares both, the class carries the
 * controller's guards and `INBOX_MAILBOX_MANAGE`, every field reaches the service method of its route, the routes' DTO
 * rules refuse what the routes refuse, and no answer type can carry a secret.
 *
 * `@gauzy/core`, `@gauzy/common` and `@gauzy/plugin` are doubled at the module boundary (`../testing/graphql-core-double`),
 * with every export the Inbox email module's files read, so the module and the plugin load.
 */
jest.mock('@gauzy/core', () => jest.requireActual('../testing/graphql-core-double').coreDouble());
jest.mock('@gauzy/common', () => jest.requireActual('../testing/graphql-core-double').commonDouble());
jest.mock('@gauzy/plugin', () => jest.requireActual('../testing/graphql-core-double').pluginDouble());

import 'reflect-metadata';
import { BadRequestException } from '@nestjs/common';
import { GUARDS_METADATA, MODULE_METADATA, ROUTE_ARGS_METADATA } from '@nestjs/common/constants';
import { buildSchema, extendSchema, GraphQLObjectType, GraphQLSchema } from 'graphql';
import { InboxProviderAccountScopeEnum, InboxProviderAccountStatusEnum, PermissionsEnum } from '@gauzy/contracts';
import { inboxSchemaExtensions } from '../../graphql/inbox.schema';
import { InboxEmailModule } from '../inbox-email.module';
import { InboxEmailPlugin } from '../inbox-email.plugin';
import {
	CreateInboxProviderAccountDTO,
	UpdateInboxProviderAccountDTO
} from '../provider-accounts/inbox-provider-account.dto';
import { inboxEmailSchemaExtensions } from './inbox-email.schema';
import { InboxProviderAccountResolver } from './inbox-provider-account.resolver';

const ACCOUNT_ID = '0b5a3f4e-6c1d-4f7a-9a52-3c2d1e0f9b8a';
const ORG_ID = '7d1c2b3a-4e5f-4a6b-8c7d-9e0f1a2b3c4d';
/** The core root types and scalars the plugin's SDL extends. */
const CORE_SDL = 'scalar DateTime\nscalar JSON\ntype Query { ping: Boolean }\ntype Mutation { ping: Boolean }';
const PROVIDER_QUERIES = ['inboxEmailProviders', 'inboxProviderAccounts', 'inboxProviderAccount'];
const PROVIDER_MUTATIONS = [
	'createInboxProviderAccount',
	'updateInboxProviderAccount',
	'deleteInboxProviderAccount',
	'verifyInboxProviderAccount'
];
/** Every member `InboxProviderAccountService.toAccount` answers (`IInboxProviderAccount`). */
const ACCOUNT_MEMBERS = [
	'id',
	'tenantId',
	'organizationId',
	'createdAt',
	'updatedAt',
	'providerId',
	'name',
	'scope',
	'status',
	'isDefaultOutbound',
	'config',
	'secretsSet',
	'capabilities',
	'lastVerifiedAt',
	'lastError',
	'webhookUrl'
];

function composed(): GraphQLSchema {
	return extendSchema(buildSchema(CORE_SDL), inboxEmailSchemaExtensions);
}

function rootFields(type: GraphQLObjectType | null | undefined): string[] {
	return Object.keys(type?.getFields() ?? {}).filter((name) => name !== 'ping');
}

function objectFields(schema: GraphQLSchema, name: string): string[] {
	return Object.keys((schema.getType(name) as GraphQLObjectType).getFields());
}

function setup() {
	const account = { id: ACCOUNT_ID, providerId: 'resend', name: 'Resend', secretsSet: ['apiKey'] };
	const accounts = {
		providers: jest.fn(() => [{ id: 'resend', displayName: 'Resend' }]),
		list: jest.fn(async () => [account]),
		get: jest.fn(async () => account),
		create: jest.fn(async () => ({ ...account, oneTimeSecrets: {}, oneTimeWebhookUrl: null })),
		update: jest.fn(async () => ({ ...account, oneTimeSecrets: { token: 'shown-once' } })),
		remove: jest.fn(async () => ({ id: ACCOUNT_ID, deleted: true })),
		verify: jest.fn(async () => ({ ok: true, checkedAt: new Date('2026-10-18T10:00:00Z') }))
	};
	return { accounts, resolver: new InboxProviderAccountResolver(accounts as never) };
}

describe('Inbox email GraphQL: provider accounts', () => {
	it('the SDL composes onto the core root types, alone and after the Inbox SDL, and declares the provider fields', () => {
		const schema = composed();
		expect(rootFields(schema.getQueryType())).toEqual(expect.arrayContaining(PROVIDER_QUERIES));
		expect(rootFields(schema.getMutationType())).toEqual(expect.arrayContaining(PROVIDER_MUTATIONS));
		// Both plugins on: the email SDL is applied after the Inbox's own, and neither redeclares the other's types.
		const both = extendSchema(
			extendSchema(buildSchema(CORE_SDL), inboxSchemaExtensions),
			inboxEmailSchemaExtensions
		);
		expect(rootFields(both.getQueryType())).toEqual(expect.arrayContaining(['inboxItems', ...PROVIDER_QUERIES]));
		// No argument names a tenant or a user: the tenant and the caller come from the credential.
		const args = [schema.getQueryType(), schema.getMutationType()].flatMap((type) =>
			Object.values(type?.getFields() ?? {}).flatMap((field) => field.args.map((arg) => arg.name))
		);
		expect(args.filter((name) => /tenant|user/i.test(name))).toEqual([]);
	});

	it('answers an account as the route does, and no answer type can carry a secret', () => {
		const schema = composed();
		expect(objectFields(schema, 'InboxProviderAccount').sort()).toEqual([...ACCOUNT_MEMBERS].sort());
		// The answer of create / update is the account plus the generated secrets, shown once (the route's shape).
		expect(objectFields(schema, 'InboxProviderAccountSaved').sort()).toEqual(
			[...ACCOUNT_MEMBERS, 'oneTimeSecrets', 'oneTimeWebhookUrl'].sort()
		);
		for (const name of ['InboxEmailProvider', 'InboxProviderAccount', 'InboxProviderAccountCheck']) {
			expect([
				name,
				objectFields(schema, name).filter((field) => /secret|encrypted|password|key/i.test(field))
			]).toEqual([name, name === 'InboxProviderAccount' ? ['secretsSet'] : []]);
		}
	});

	it('is wired: each root field is bound to its method, the module provides the resolver, the plugin declares both', () => {
		const schema = composed();
		const bound = (type: 'Query' | 'Mutation', names: string[]) => {
			for (const name of names) {
				const method = (InboxProviderAccountResolver.prototype as unknown as Record<string, object>)[name];
				expect([name, typeof method]).toEqual([name, 'function']);
				expect([name, Reflect.getMetadata('graphql:resolver_type', method)]).toEqual([name, type]);
				expect(Reflect.getMetadata('graphql:resolver_name', method)).toBe(name);
			}
		};
		bound(
			'Query',
			rootFields(schema.getQueryType()).filter((name) => PROVIDER_QUERIES.includes(name))
		);
		bound(
			'Mutation',
			rootFields(schema.getMutationType()).filter((name) => PROVIDER_MUTATIONS.includes(name))
		);
		// A resolver only the plugin metadata names is never registered: the module must provide it too.
		expect(Reflect.getMetadata(MODULE_METADATA.PROVIDERS, InboxEmailModule)).toContain(
			InboxProviderAccountResolver
		);
		const declared = (
			InboxEmailPlugin as unknown as { declared: { extensions: { schema: unknown; resolvers: unknown[] } } }
		).declared;
		expect(declared.extensions.schema).toBe(inboxEmailSchemaExtensions);
		expect(declared.extensions.resolvers).toContain(InboxProviderAccountResolver);
	});

	it('carries the controller’s guards, FEATURE_GRAPHQL and INBOX_MAILBOX_MANAGE (class and every field)', () => {
		const guards = (
			Reflect.getMetadata(GUARDS_METADATA, InboxProviderAccountResolver) as Array<{ name: string }>
		).map((guard) => guard.name);
		expect(guards).toEqual(['TenantPermissionGuard', 'PermissionGuard', 'FeatureFlagGuard']);
		expect(Reflect.getMetadata('feature', InboxProviderAccountResolver)).toBe('FEATURE_GRAPHQL');
		expect(Reflect.getMetadata('permissions', InboxProviderAccountResolver)).toEqual([
			PermissionsEnum.INBOX_MAILBOX_MANAGE
		]);
		for (const name of [...PROVIDER_QUERIES, ...PROVIDER_MUTATIONS]) {
			const method = (InboxProviderAccountResolver.prototype as unknown as Record<string, object>)[name];
			expect([name, Reflect.getMetadata('permissions', method)]).toEqual([
				name,
				[PermissionsEnum.INBOX_MAILBOX_MANAGE]
			]);
		}
	});

	it('every id argument goes through the route’s UUID pipe', () => {
		for (const name of [
			'inboxProviderAccount',
			'updateInboxProviderAccount',
			'deleteInboxProviderAccount',
			'verifyInboxProviderAccount'
		]) {
			const args = Reflect.getMetadata(ROUTE_ARGS_METADATA, InboxProviderAccountResolver, name) as Record<
				string,
				{ index: number; data: string; pipes: Array<{ name?: string }> }
			>;
			const id = Object.values(args).find((arg) => arg.index === 0);
			expect([name, id?.data, id?.pipes.map((pipe) => pipe.name)]).toEqual([name, 'id', ['UUIDValidationPipe']]);
		}
	});

	it('the reads reach the service methods of their routes, with the stated organization', async () => {
		const { accounts, resolver } = setup();
		expect(resolver.inboxEmailProviders()).toEqual([{ id: 'resend', displayName: 'Resend' }]);
		await resolver.inboxProviderAccounts(ORG_ID);
		expect(accounts.list).toHaveBeenCalledWith(ORG_ID);
		await resolver.inboxProviderAccounts(null);
		expect(accounts.list).toHaveBeenLastCalledWith(undefined);
		expect(await resolver.inboxProviderAccount(ACCOUNT_ID, ORG_ID)).toMatchObject({ id: ACCOUNT_ID });
		expect(accounts.get).toHaveBeenCalledWith(ACCOUNT_ID, ORG_ID);
	});

	it('the writes reach the service methods of their routes, with the route DTO’s members only', async () => {
		const { accounts, resolver } = setup();
		await resolver.createInboxProviderAccount({
			providerId: 'resend',
			name: 'Resend',
			scope: InboxProviderAccountScopeEnum.ORGANIZATION,
			organizationId: ORG_ID,
			config: { apiKey: 're_live_secret' },
			isDefaultOutbound: true,
			tenantId: 'not-a-member-of-the-dto'
		} as never);
		const [created] = accounts.create.mock.calls[0] as unknown as [CreateInboxProviderAccountDTO];
		expect(created).toBeInstanceOf(CreateInboxProviderAccountDTO);
		expect({ ...created }).toEqual({
			providerId: 'resend',
			name: 'Resend',
			scope: InboxProviderAccountScopeEnum.ORGANIZATION,
			organizationId: ORG_ID,
			config: { apiKey: 're_live_secret' },
			isDefaultOutbound: true
		});

		const saved = await resolver.updateInboxProviderAccount(
			ACCOUNT_ID,
			{ status: InboxProviderAccountStatusEnum.DISABLED, config: { token: null } },
			ORG_ID
		);
		expect(saved.oneTimeSecrets).toEqual({ token: 'shown-once' });
		const [id, change, organizationId] = accounts.update.mock.calls[0] as unknown as [
			string,
			UpdateInboxProviderAccountDTO,
			string
		];
		expect([id, { ...change }, organizationId]).toEqual([
			ACCOUNT_ID,
			{ status: InboxProviderAccountStatusEnum.DISABLED, config: { token: null } },
			ORG_ID
		]);

		expect(await resolver.deleteInboxProviderAccount(ACCOUNT_ID, ORG_ID)).toEqual({
			id: ACCOUNT_ID,
			deleted: true
		});
		expect(accounts.remove).toHaveBeenCalledWith(ACCOUNT_ID, ORG_ID);
		expect(await resolver.verifyInboxProviderAccount(ACCOUNT_ID, null)).toMatchObject({ ok: true });
		expect(accounts.verify).toHaveBeenCalledWith(ACCOUNT_ID, undefined);
	});

	it('the routes’ DTO rules refuse what the routes refuse, before the service', async () => {
		const { accounts, resolver } = setup();
		const refused = [
			resolver.createInboxProviderAccount({ providerId: 'Not A Provider!', name: 'x' }),
			resolver.createInboxProviderAccount({ providerId: 'resend', name: 'x'.repeat(121) }),
			resolver.createInboxProviderAccount({ providerId: 'resend', name: 'x', scope: 'EVERYONE' as never }),
			resolver.createInboxProviderAccount({ providerId: 'resend', name: 'x', organizationId: 'not-a-uuid' }),
			resolver.createInboxProviderAccount({ providerId: 'resend', name: 'x', config: 'apiKey=1' as never }),
			resolver.updateInboxProviderAccount(ACCOUNT_ID, { status: InboxProviderAccountStatusEnum.ERROR as never }),
			resolver.updateInboxProviderAccount(ACCOUNT_ID, { isDefaultOutbound: 'yes' as never }),
			resolver.updateInboxProviderAccount(ACCOUNT_ID, {}, 'not-a-uuid'),
			resolver.inboxProviderAccounts('not-a-uuid'),
			resolver.inboxProviderAccount(ACCOUNT_ID, 'not-a-uuid'),
			resolver.deleteInboxProviderAccount(ACCOUNT_ID, 'not-a-uuid'),
			resolver.verifyInboxProviderAccount(ACCOUNT_ID, 'not-a-uuid')
		];
		for (const attempt of refused) {
			await expect(attempt).rejects.toBeInstanceOf(BadRequestException);
		}
		for (const method of ['list', 'get', 'create', 'update', 'remove', 'verify'] as const) {
			expect(accounts[method]).not.toHaveBeenCalled();
		}
	});
});
