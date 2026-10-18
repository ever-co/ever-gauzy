/**
 * The GraphQL twins of the mailbox routes (`/inbox/mailboxes*`, G-P4-1): the SDL declares every route's field and
 * answers a mailbox as the route does (never its relay secret or verification token, except the secret a rotation
 * answers once), every root field is bound to its resolver method, the module provides the resolver and the plugin
 * declares it, `INBOX_VIEW` guards "my mailboxes" and `INBOX_MAILBOX_MANAGE` everything else (as on the controller),
 * every field reaches the service method of its route, and the routes' DTO rules refuse what the routes refuse.
 */
jest.mock('@gauzy/core', () => jest.requireActual('../testing/graphql-core-double').coreDouble());
jest.mock('@gauzy/common', () => jest.requireActual('../testing/graphql-core-double').commonDouble());
jest.mock('@gauzy/plugin', () => jest.requireActual('../testing/graphql-core-double').pluginDouble());

import 'reflect-metadata';
import { BadRequestException } from '@nestjs/common';
import { GUARDS_METADATA, MODULE_METADATA, ROUTE_ARGS_METADATA } from '@nestjs/common/constants';
import { buildSchema, extendSchema, GraphQLObjectType, GraphQLSchema } from 'graphql';
import {
	InboxMailboxKindEnum,
	InboxMailboxMemberRoleEnum,
	InboxMailboxOwnerTypeEnum,
	PermissionsEnum
} from '@gauzy/contracts';
import { InboxEmailModule } from '../inbox-email.module';
import { InboxEmailPlugin } from '../inbox-email.plugin';
import {
	CreateInboxMailboxDTO,
	InboxEmailSettingsDTO,
	InboxMailboxMemberDTO,
	ProvisionInboxMailboxesDTO,
	UpdateInboxMailboxDTO
} from '../mailboxes/inbox-mailbox.dto';
import { inboxEmailSchemaExtensions } from './inbox-email.schema';
import { InboxMailboxResolver } from './inbox-mailbox.resolver';

const MAILBOX_ID = '0b5a3f4e-6c1d-4f7a-9a52-3c2d1e0f9b8a';
const ORG_ID = '7d1c2b3a-4e5f-4a6b-8c7d-9e0f1a2b3c4d';
const USER_ID = '1f2e3d4c-5b6a-4978-8695-a4b3c2d1e0f9';
const AGENT_ID = '9a8b7c6d-5e4f-4a3b-9c2d-1e0f9a8b7c6d';
const CORE_SDL = 'scalar DateTime\nscalar JSON\ntype Query { ping: Boolean }\ntype Mutation { ping: Boolean }';
const QUERIES = [
	'myInboxMailboxes',
	'inboxMailboxes',
	'inboxMailbox',
	'inboxMailboxDomainVerification',
	'inboxMailboxMembers',
	'inboxEmailSettings'
];
const MUTATIONS = [
	'createInboxMailbox',
	'updateInboxMailbox',
	'verifyInboxMailboxDomain',
	'rotateInboxMailboxSecret',
	'setInboxMailboxMembers',
	'provisionInboxMailboxes',
	'updateInboxEmailSettings'
];
/** Every member `InboxMailboxService.toMailbox` answers (`IInboxMailbox`). */
const MAILBOX_MEMBERS = [
	'id',
	'tenantId',
	'organizationId',
	'createdAt',
	'updatedAt',
	'isActive',
	'address',
	'displayName',
	'kind',
	'ownerType',
	'ownerEmployeeId',
	'ownerTeamId',
	'purpose',
	'providerAccountId',
	'senderAllowlist',
	'domain',
	'domainStatus',
	'isDefault',
	'autoProvisioned',
	'lastMessageAt',
	'messageCount',
	'settings'
];

function composed(): GraphQLSchema {
	return extendSchema(buildSchema(CORE_SDL), inboxEmailSchemaExtensions);
}

function objectFields(schema: GraphQLSchema, name: string): string[] {
	return Object.keys((schema.getType(name) as GraphQLObjectType).getFields()).sort();
}

function method(name: string): object {
	return (InboxMailboxResolver.prototype as unknown as Record<string, object>)[name];
}

function setup() {
	const mailbox = { id: MAILBOX_ID, address: 'support.ever@inbox.example' };
	const verification = {
		recordType: 'TXT',
		recordName: '_gauzy-inbox.acme.com',
		recordValue: 'v',
		status: 'PENDING'
	};
	const mailboxes = {
		mine: jest.fn(async () => [{ ...mailbox, forwardingInstructions: 'Forward to support.ever@inbox.example' }]),
		list: jest.fn(async () => [mailbox]),
		get: jest.fn(async () => mailbox),
		verification: jest.fn(async () => verification),
		members: jest.fn(async () => [{ userId: USER_ID, role: 'READER' }]),
		settings: jest.fn(async () => ({
			organizationId: ORG_ID,
			autoProvisionEmployees: false,
			platformDomain: null
		})),
		create: jest.fn(async () => ({ ...mailbox, verification })),
		update: jest.fn(async () => mailbox),
		verify: jest.fn(async () => ({ ...verification, status: 'VERIFIED' })),
		rotateSecret: jest.fn(async () => ({ address: mailbox.address, inboundSecret: 'shown-once' })),
		setMembers: jest.fn(async () => [{ userId: USER_ID, role: 'MANAGER' }]),
		provision: jest.fn(async () => ({ created: [mailbox], existing: 2 })),
		updateSettings: jest.fn(async () => ({ organizationId: ORG_ID, autoProvisionEmployees: true }))
	};
	return { mailboxes, resolver: new InboxMailboxResolver(mailboxes as never) };
}

describe('Inbox email GraphQL: mailboxes', () => {
	it('declares a field for every mailbox route, and no argument names a tenant', () => {
		const schema = composed();
		const query = Object.keys(schema.getQueryType()?.getFields() ?? {});
		const mutation = Object.keys(schema.getMutationType()?.getFields() ?? {});
		expect(query).toEqual(expect.arrayContaining(QUERIES));
		expect(mutation).toEqual(expect.arrayContaining(MUTATIONS));
		const args = [
			...QUERIES.map((name) => schema.getQueryType()?.getFields()[name]),
			...MUTATIONS.map((name) => schema.getMutationType()?.getFields()[name])
		].flatMap((field) => field?.args.map((arg) => arg.name) ?? []);
		expect(args.filter((name) => /tenant/i.test(name))).toEqual([]);
	});

	it('answers a mailbox as the route does: never its relay secret or its verification token', () => {
		const schema = composed();
		expect(objectFields(schema, 'InboxMailbox')).toEqual([...MAILBOX_MEMBERS].sort());
		expect(objectFields(schema, 'InboxMailboxCreated')).toEqual([...MAILBOX_MEMBERS, 'verification'].sort());
		expect(objectFields(schema, 'InboxMyMailbox')).toEqual([...MAILBOX_MEMBERS, 'forwardingInstructions'].sort());
		for (const name of [
			'InboxMailbox',
			'InboxMailboxCreated',
			'InboxMyMailbox',
			'InboxMailboxDomainVerification'
		]) {
			expect([name, objectFields(schema, name).filter((field) => /secret|hash|token/i.test(field))]).toEqual([
				name,
				[]
			]);
		}
		// The rotation answers the new secret once, and that is the only type that carries one.
		expect(objectFields(schema, 'InboxMailboxSecret')).toEqual(['address', 'inboundSecret']);
	});

	it('is wired: each root field is bound to its method, the module provides the resolver, the plugin declares it', () => {
		for (const [type, names] of [
			['Query', QUERIES],
			['Mutation', MUTATIONS]
		] as const) {
			for (const name of names) {
				expect([name, typeof method(name)]).toEqual([name, 'function']);
				expect([name, Reflect.getMetadata('graphql:resolver_type', method(name))]).toEqual([name, type]);
				expect(Reflect.getMetadata('graphql:resolver_name', method(name))).toBe(name);
			}
		}
		expect(Reflect.getMetadata(MODULE_METADATA.PROVIDERS, InboxEmailModule)).toContain(InboxMailboxResolver);
		const declared = (
			InboxEmailPlugin as unknown as { declared: { extensions: { schema: unknown; resolvers: unknown[] } } }
		).declared;
		expect(declared.extensions.schema).toBe(inboxEmailSchemaExtensions);
		expect(declared.extensions.resolvers).toContain(InboxMailboxResolver);
	});

	it('carries the controller’s guards and permissions: INBOX_VIEW for my mailboxes, INBOX_MAILBOX_MANAGE for the rest', () => {
		const guards = (Reflect.getMetadata(GUARDS_METADATA, InboxMailboxResolver) as Array<{ name: string }>).map(
			(guard) => guard.name
		);
		expect(guards).toEqual(['TenantPermissionGuard', 'PermissionGuard', 'FeatureFlagGuard']);
		expect(Reflect.getMetadata('feature', InboxMailboxResolver)).toBe('FEATURE_GRAPHQL');
		// The class default is the stricter one; a field states its own (the guard reads the field's first).
		expect(Reflect.getMetadata('permissions', InboxMailboxResolver)).toEqual([
			PermissionsEnum.INBOX_MAILBOX_MANAGE
		]);
		for (const name of [...QUERIES, ...MUTATIONS]) {
			expect([name, Reflect.getMetadata('permissions', method(name))]).toEqual([
				name,
				[name === 'myInboxMailboxes' ? PermissionsEnum.INBOX_VIEW : PermissionsEnum.INBOX_MAILBOX_MANAGE]
			]);
		}
	});

	it('every mailbox id argument goes through the route’s UUID pipe', () => {
		for (const name of [
			'inboxMailbox',
			'inboxMailboxDomainVerification',
			'inboxMailboxMembers',
			'updateInboxMailbox',
			'verifyInboxMailboxDomain',
			'rotateInboxMailboxSecret',
			'setInboxMailboxMembers'
		]) {
			const args = Reflect.getMetadata(ROUTE_ARGS_METADATA, InboxMailboxResolver, name) as Record<
				string,
				{ index: number; data: string; pipes: Array<{ name?: string }> }
			>;
			const id = Object.values(args).find((arg) => arg.index === 0);
			expect([name, id?.data, id?.pipes.map((pipe) => pipe.name)]).toEqual([name, 'id', ['UUIDValidationPipe']]);
		}
	});

	it('the reads reach the service methods of their routes, with the stated organization', async () => {
		const { mailboxes, resolver } = setup();
		expect(await resolver.myInboxMailboxes()).toEqual([
			expect.objectContaining({ id: MAILBOX_ID, forwardingInstructions: expect.any(String) })
		]);
		await resolver.inboxMailboxes(ORG_ID);
		expect(mailboxes.list).toHaveBeenCalledWith(ORG_ID);
		await resolver.inboxMailboxes(null);
		expect(mailboxes.list).toHaveBeenLastCalledWith(undefined);
		await resolver.inboxMailbox(MAILBOX_ID, ORG_ID);
		expect(mailboxes.get).toHaveBeenCalledWith(MAILBOX_ID, ORG_ID);
		await resolver.inboxMailboxDomainVerification(MAILBOX_ID, null);
		expect(mailboxes.verification).toHaveBeenCalledWith(MAILBOX_ID, undefined);
		await resolver.inboxMailboxMembers(MAILBOX_ID, ORG_ID);
		expect(mailboxes.members).toHaveBeenCalledWith(MAILBOX_ID, ORG_ID);
		expect(await resolver.inboxEmailSettings(ORG_ID)).toMatchObject({ autoProvisionEmployees: false });
		expect(mailboxes.settings).toHaveBeenCalledWith(ORG_ID);
	});

	it('the writes reach the service methods of their routes, with the route DTOs’ members only', async () => {
		const { mailboxes, resolver } = setup();
		await resolver.createInboxMailbox({
			ownerType: InboxMailboxOwnerTypeEnum.ORGANIZATION,
			kind: InboxMailboxKindEnum.CUSTOM_DOMAIN,
			localPart: 'support',
			domain: 'acme.com',
			organizationId: ORG_ID,
			isDefault: true,
			tenantId: 'dropped'
		} as never);
		const [created] = mailboxes.create.mock.calls[0] as unknown as [CreateInboxMailboxDTO];
		expect(created).toEqual(
			Object.assign(new CreateInboxMailboxDTO(), {
				ownerType: InboxMailboxOwnerTypeEnum.ORGANIZATION,
				kind: InboxMailboxKindEnum.CUSTOM_DOMAIN,
				localPart: 'support',
				domain: 'acme.com',
				organizationId: ORG_ID,
				isDefault: true
			})
		);

		// Routing a mailbox to an Ever Works agent is a settings change (P4c `settings.everWorksAgentId`).
		await resolver.updateInboxMailbox(
			MAILBOX_ID,
			{ settings: { everWorksAgentId: AGENT_ID }, providerAccountId: null },
			ORG_ID
		);
		const [id, change, organizationId] = mailboxes.update.mock.calls[0] as unknown as [
			string,
			UpdateInboxMailboxDTO,
			string
		];
		expect([id, change, organizationId]).toEqual([
			MAILBOX_ID,
			Object.assign(new UpdateInboxMailboxDTO(), {
				settings: { everWorksAgentId: AGENT_ID },
				providerAccountId: null
			}),
			ORG_ID
		]);

		expect(await resolver.verifyInboxMailboxDomain(MAILBOX_ID, ORG_ID)).toMatchObject({ status: 'VERIFIED' });
		expect(mailboxes.verify).toHaveBeenCalledWith(MAILBOX_ID, ORG_ID);
		expect(await resolver.rotateInboxMailboxSecret(MAILBOX_ID, null)).toEqual({
			address: 'support.ever@inbox.example',
			inboundSecret: 'shown-once'
		});
		expect(mailboxes.rotateSecret).toHaveBeenCalledWith(MAILBOX_ID, undefined);

		await resolver.setInboxMailboxMembers(
			MAILBOX_ID,
			[{ userId: USER_ID, role: InboxMailboxMemberRoleEnum.MANAGER }],
			ORG_ID
		);
		const [, members, membersOrganization] = mailboxes.setMembers.mock.calls[0] as unknown as [
			string,
			InboxMailboxMemberDTO[],
			string
		];
		expect([members, membersOrganization]).toEqual([
			[Object.assign(new InboxMailboxMemberDTO(), { userId: USER_ID, role: InboxMailboxMemberRoleEnum.MANAGER })],
			ORG_ID
		]);

		await resolver.provisionInboxMailboxes({ organizationId: ORG_ID, employees: true });
		expect(mailboxes.provision).toHaveBeenCalledWith(
			Object.assign(new ProvisionInboxMailboxesDTO(), { organizationId: ORG_ID, employees: true })
		);
		await resolver.provisionInboxMailboxes(null);
		expect(mailboxes.provision).toHaveBeenLastCalledWith(new ProvisionInboxMailboxesDTO());

		await resolver.updateInboxEmailSettings({ autoProvisionEmployees: true }, ORG_ID);
		expect(mailboxes.updateSettings).toHaveBeenCalledWith(
			Object.assign(new InboxEmailSettingsDTO(), { autoProvisionEmployees: true }),
			ORG_ID
		);
	});

	it('the routes’ DTO rules refuse what the routes refuse, before the service', async () => {
		const { mailboxes, resolver } = setup();
		const owner = { ownerType: InboxMailboxOwnerTypeEnum.ORGANIZATION };
		const refused: Array<Promise<unknown>> = [
			resolver.createInboxMailbox({ ownerType: 'NOBODY' as never }),
			resolver.createInboxMailbox({ ...owner, kind: InboxMailboxKindEnum.CONNECTED as never }),
			resolver.createInboxMailbox({ ...owner, localPart: 'x'.repeat(65) }),
			resolver.createInboxMailbox({
				...owner,
				senderAllowlist: Array.from({ length: 201 }, (_, i) => `s${i}@a.com`)
			}),
			resolver.createInboxMailbox({ ...owner, providerAccountId: 'not-a-uuid' }),
			resolver.createInboxMailbox({ ...owner, organizationId: 'not-a-uuid' }),
			resolver.updateInboxMailbox(MAILBOX_ID, { settings: 'route-to-agent' as never }),
			resolver.updateInboxMailbox(MAILBOX_ID, { isActive: 'yes' as never }),
			resolver.updateInboxMailbox(MAILBOX_ID, {}, 'not-a-uuid'),
			resolver.setInboxMailboxMembers(MAILBOX_ID, [{ userId: 'not-a-uuid' }]),
			resolver.setInboxMailboxMembers(MAILBOX_ID, [{ userId: USER_ID, role: 'OWNER' as never }]),
			resolver.setInboxMailboxMembers(
				MAILBOX_ID,
				Array.from({ length: 501 }, () => ({ userId: USER_ID }))
			),
			resolver.provisionInboxMailboxes({ employees: 'yes' as never }),
			resolver.updateInboxEmailSettings({} as never),
			resolver.inboxMailboxes('not-a-uuid'),
			resolver.inboxEmailSettings('not-a-uuid'),
			resolver.rotateInboxMailboxSecret(MAILBOX_ID, 'not-a-uuid')
		];
		for (const attempt of refused) {
			await expect(attempt).rejects.toBeInstanceOf(BadRequestException);
		}
		for (const name of Object.keys(mailboxes) as Array<keyof typeof mailboxes>) {
			expect([name, mailboxes[name].mock.calls.length]).toEqual([name, 0]);
		}
	});
});
