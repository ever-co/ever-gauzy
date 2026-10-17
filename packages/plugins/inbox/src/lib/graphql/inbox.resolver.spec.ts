/**
 * The Inbox GraphQL mirror (plan 04 §3): its SDL composes onto the core root types, every root field it declares
 * has its resolver method, the class carries the controller's guards and `INBOX_VIEW`, every field reaches the
 * `InboxService` method its REST route reaches, and the route's DTO rules refuse what the route refuses.
 *
 * `@gauzy/core` is doubled at the module boundary (its barrel boots the whole application), as the plugin's other
 * suites do.
 */
jest.mock('@gauzy/core', () => {
	const decorator = () => () => undefined;
	const { SetMetadata, NotAcceptableException } = jest.requireActual('@nestjs/common');
	return {
		ExportRedacted: decorator,
		MultiORMColumn: decorator,
		MultiORMEntity: decorator,
		UseValidationPipe: decorator,
		TenantOrganizationBaseEntity: class {},
		MikroOrmBaseEntityRepository: class {},
		RolePermissionModule: class RolePermissionModule {},
		RequestContext: { currentTenantId: () => null, currentUserId: () => null, hasPermission: () => false },
		FEATURE_GRAPHQL: 'FEATURE_GRAPHQL',
		FeatureFlagGuard: class FeatureFlagGuard {},
		PermissionGuard: class PermissionGuard {},
		TenantPermissionGuard: class TenantPermissionGuard {},
		Permissions: (...permissions: string[]) => SetMetadata('permissions', permissions),
		UUIDValidationPipe: class UUIDValidationPipe {
			transform(value: string) {
				if (!/^[0-9a-f-]{36}$/i.test(value ?? ''))
					throw new NotAcceptableException('Validation failed (valid uuid is expected)');
				return value;
			}
		}
	};
});
jest.mock('@gauzy/common', () => ({
	FeatureFlag: (flag: string) => jest.requireActual('@nestjs/common').SetMetadata('feature', flag)
}));
// The plugin decorator records what the plugin declares (the real one loads the configuration package).
jest.mock('@gauzy/plugin', () => ({
	GauzyCorePlugin: (metadata: unknown) => (target: { declared?: unknown }) => {
		target.declared = metadata;
	}
}));

import 'reflect-metadata';
import { BadRequestException } from '@nestjs/common';
import { GUARDS_METADATA, MODULE_METADATA, ROUTE_ARGS_METADATA } from '@nestjs/common/constants';
import { buildSchema, extendSchema, GraphQLObjectType } from 'graphql';
import { InboxTabEnum, PermissionsEnum } from '@gauzy/contracts';
import { UUIDValidationPipe } from '@gauzy/core';
import { InboxResolver, validatedInboxInput } from './inbox.resolver';
import { inboxSchemaExtensions } from './inbox.schema';
import { InboxStateDTO } from '../dto/inbox.dto';
import { InboxModule } from '../inbox.module';
import { InboxPlugin } from '../inbox.plugin';

const ITEM_ID = '0b5a3f4e-6c1d-4f7a-9a52-3c2d1e0f9b8a';
/** The core root types and scalars the plugin's SDL extends. */
const CORE_SDL = 'scalar DateTime\nscalar JSON\ntype Query { ping: Boolean }\ntype Mutation { ping: Boolean }';

function setup() {
	const answer = { id: ITEM_ID, recipient: { isRead: true } };
	const inbox = {
		list: jest.fn(async () => ({ items: [answer], nextCursor: null })),
		counts: jest.fn(async () => ({ unread: 2, decisionsOpen: 1, byMailbox: [] })),
		get: jest.fn(async () => answer),
		setState: jest.fn(async () => answer)
	};
	return { inbox, resolver: new InboxResolver(inbox as never) };
}

describe('Inbox GraphQL mirror', () => {
	it('the SDL composes onto the core root types, and every root field it declares has its resolver method', () => {
		const core = buildSchema(CORE_SDL);
		const schema = extendSchema(core, inboxSchemaExtensions);
		const fields = (type: GraphQLObjectType | null | undefined) =>
			Object.keys(type?.getFields() ?? {}).filter((name) => name !== 'ping');
		expect(fields(schema.getQueryType())).toEqual(['inboxItems', 'inboxItemCounts', 'inboxItem']);
		expect(fields(schema.getMutationType())).toEqual(['markInboxItem']);
		for (const name of [...fields(schema.getQueryType()), ...fields(schema.getMutationType())]) {
			expect(typeof (InboxResolver.prototype as unknown as Record<string, unknown>)[name]).toBe('function');
		}
		// No argument names a user, a recipient or a tenant: the recipient is the caller.
		const args = [schema.getQueryType(), schema.getMutationType()].flatMap((type) =>
			Object.values(type?.getFields() ?? {}).flatMap((field) => field.args.map((arg) => arg.name))
		);
		expect(args.filter((name) => /user|recipient|tenant/i.test(name))).toEqual([]);
	});

	it('is wired: each SDL root field is bound to its method, the module provides the resolver, the plugin declares both', () => {
		const core = buildSchema(CORE_SDL);
		const schema = extendSchema(core, inboxSchemaExtensions);
		const bound = (type: 'Query' | 'Mutation', root: GraphQLObjectType | null | undefined) => {
			for (const name of Object.keys(root?.getFields() ?? {}).filter((field) => field !== 'ping')) {
				const method = (InboxResolver.prototype as unknown as Record<string, object>)[name];
				expect([name, Reflect.getMetadata('graphql:resolver_type', method)]).toEqual([name, type]);
				expect(Reflect.getMetadata('graphql:resolver_name', method)).toBe(name);
			}
		};
		bound('Query', schema.getQueryType());
		bound('Mutation', schema.getMutationType());
		// A resolver only the plugin metadata names is never registered: the module must provide it too.
		expect(Reflect.getMetadata(MODULE_METADATA.PROVIDERS, InboxModule)).toContain(InboxResolver);
		const declared = (
			InboxPlugin as unknown as { declared: { extensions: { schema: unknown; resolvers: unknown[] } } }
		).declared;
		expect(declared.extensions.schema).toBe(inboxSchemaExtensions);
		expect(declared.extensions.resolvers).toEqual([InboxResolver]);
	});

	it('the GraphQL capability gate is FEATURE_GRAPHQL, and both id arguments go through the route’s UUID pipe', () => {
		expect(Reflect.getMetadata('feature', InboxResolver)).toBe('FEATURE_GRAPHQL');
		for (const name of ['inboxItem', 'markInboxItem']) {
			const args = Reflect.getMetadata(ROUTE_ARGS_METADATA, InboxResolver, name) as Record<
				string,
				{ index: number; data: string; pipes: Array<{ name?: string }> }
			>;
			const id = Object.values(args).find((arg) => arg.index === 0);
			expect([name, id?.data, id?.pipes.map((pipe) => pipe.name)]).toEqual([name, 'id', ['UUIDValidationPipe']]);
		}
		expect(() => new UUIDValidationPipe().transform('not-an-id', {} as never)).toThrow('valid uuid');
	});

	it('carries the controller’s guards and INBOX_VIEW (class and every field)', () => {
		const guards = (Reflect.getMetadata(GUARDS_METADATA, InboxResolver) as Array<{ name: string }>).map(
			(guard) => guard.name
		);
		expect(guards).toEqual(['TenantPermissionGuard', 'PermissionGuard', 'FeatureFlagGuard']);
		expect(Reflect.getMetadata('permissions', InboxResolver)).toEqual([PermissionsEnum.INBOX_VIEW]);
		for (const name of ['inboxItems', 'inboxItemCounts', 'inboxItem', 'markInboxItem']) {
			expect(
				Reflect.getMetadata('permissions', (InboxResolver.prototype as unknown as Record<string, object>)[name])
			).toEqual([PermissionsEnum.INBOX_VIEW]);
		}
	});

	it('the reads reach the service methods of their routes, with the filter, cursor and limit of the list', async () => {
		const { inbox, resolver } = setup();
		await resolver.inboxItems({ tab: InboxTabEnum.DECISIONS, unread: true }, 'b246', 5);
		expect(inbox.list).toHaveBeenCalledWith(
			expect.objectContaining({ tab: 'decisions', unread: true, cursor: 'b246', limit: 5 })
		);
		await resolver.inboxItems(null, null, null);
		expect(inbox.list).toHaveBeenLastCalledWith(expect.not.objectContaining({ cursor: expect.anything() }));
		expect(await resolver.inboxItemCounts()).toEqual({ unread: 2, decisionsOpen: 1, byMailbox: [] });
		expect(await resolver.inboxItem(ITEM_ID)).toMatchObject({ id: ITEM_ID });
		expect(inbox.get).toHaveBeenCalledWith(ITEM_ID);
	});

	it('the route’s DTO rules refuse what the route refuses, before the service', async () => {
		const { inbox, resolver } = setup();
		await expect(resolver.inboxItems({ tab: 'everything' as never })).rejects.toBeInstanceOf(BadRequestException);
		await expect(resolver.inboxItems({}, null, 1000)).rejects.toBeInstanceOf(BadRequestException);
		await expect(resolver.inboxItems({ mailboxId: 'not-a-uuid' })).rejects.toBeInstanceOf(BadRequestException);
		await expect(resolver.inboxItems({ q: 'x'.repeat(201) })).rejects.toBeInstanceOf(BadRequestException);
		await expect(resolver.markInboxItem(ITEM_ID, { isRead: 'yes' as never })).rejects.toBeInstanceOf(
			BadRequestException
		);
		expect(inbox.list).not.toHaveBeenCalled();
		expect(inbox.setState).not.toHaveBeenCalled();
	});

	it('markInboxItem sets the caller’s own state through the state route’s method (a time, or null to un-snooze)', async () => {
		const { inbox, resolver } = setup();
		await resolver.markInboxItem(ITEM_ID, { isRead: false, snoozedUntil: '2026-10-20T09:00:00Z' });
		const [id, state] = inbox.setState.mock.calls[0] as unknown as [string, InboxStateDTO];
		expect(id).toBe(ITEM_ID);
		expect(state.isRead).toBe(false);
		expect(state.snoozedUntil).toEqual(new Date('2026-10-20T09:00:00Z'));
		await resolver.markInboxItem(ITEM_ID, { snoozedUntil: null });
		expect((inbox.setState.mock.calls[1] as unknown as [string, InboxStateDTO])[1].snoozedUntil).toBeNull();
		expect(await validatedInboxInput(InboxStateDTO, { isArchived: true, extra: 'dropped' })).toEqual(
			Object.assign(new InboxStateDTO(), { isArchived: true })
		);
	});
});
