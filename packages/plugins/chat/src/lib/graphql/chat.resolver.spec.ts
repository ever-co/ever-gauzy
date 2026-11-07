/**
 * The chat GraphQL mirror (the chat spec, T17): its SDL composes onto the core root types, every root field it
 * declares has its resolver method bound to it, the class carries the controllers' guards, `CHAT_VIEW` and both
 * feature flags, every id argument goes through the route's UUID pipe, every field reaches the service method its
 * REST route reaches with the caller, and the route's DTO rules refuse what the route refuses.
 *
 * `@gauzy/core` is doubled at the module boundary (its barrel boots the whole application): the names the resolver
 * and the services use are given, every other name is a harmless decorator / class.
 */
jest.mock('@gauzy/core', () => {
	const { SetMetadata, NotAcceptableException } = jest.requireActual('@nestjs/common');
	const decorator = () => () => undefined;
	const explicit: Record<string, unknown> = {
		__esModule: true,
		FEATURE_GRAPHQL: 'FEATURE_GRAPHQL',
		FeatureFlagGuard: class FeatureFlagGuard {},
		PermissionGuard: class PermissionGuard {},
		TenantPermissionGuard: class TenantPermissionGuard {},
		Permissions: (...permissions: string[]) => SetMetadata('permissions', permissions),
		UUIDValidationPipe: class UUIDValidationPipe {
			transform(value: string) {
				if (!/^[0-9a-f-]{36}$/i.test(value ?? '')) throw new NotAcceptableException('Validation failed (valid uuid is expected)');
				return value;
			}
		},
		MultiORMColumn: decorator,
		MultiORMEntity: decorator,
		MultiORMManyToOne: decorator,
		MultiORMOneToMany: decorator,
		ColumnIndex: decorator,
		UseValidationPipe: decorator,
		TenantOrganizationBaseEntity: class {},
		MikroOrmBaseEntityRepository: class {},
		RequestContext: { currentTenantId: () => null, currentUserId: () => null, hasPermission: () => false }
	};
	// Any other name: a function that serves as a no-op decorator and as a base class.
	return new Proxy(explicit, { get: (target, name) => (name in target ? target[name as string] : function Anything() {}) });
});
jest.mock('@gauzy/common', () => ({
	// The real decorator accumulates: a target may require more than one code.
	FeatureFlag: (flag: string) => (target: object) => {
		const flags = (Reflect.getMetadata('feature', target) as string[] | undefined) ?? [];
		Reflect.defineMetadata('feature', [...flags, flag], target);
	}
}));

import 'reflect-metadata';
import { BadRequestException } from '@nestjs/common';
import { GUARDS_METADATA, ROUTE_ARGS_METADATA } from '@nestjs/common/constants';
import { buildSchema, extendSchema, GraphQLObjectType } from 'graphql';
import { FeatureEnum, PermissionsEnum } from '@gauzy/contracts';
import { UUIDValidationPipe } from '@gauzy/core';
import { ChatResolver, validatedChatInput } from './chat.resolver';
import { chatSchemaExtensions } from './chat.schema';
import { ChatMessagesQueryDTO } from '../dto/chat.dto';

const CONVERSATION_ID = '0b5a3f4e-6c1d-4f7a-9a52-3c2d1e0f9b8a';
const MESSAGE_ID = '7c1d2e3f-4a5b-4c6d-8e9f-0a1b2c3d4e5f';
/** The core root types and scalars the plugin's SDL extends. */
const CORE_SDL = 'scalar DateTime\nscalar JSON\ntype Query { ping: Boolean }\ntype Mutation { ping: Boolean }';
const QUERIES = [
	'chatPeople',
	'chatCategories',
	'chatConversations',
	'chatBrowseConversations',
	'chatStates',
	'chatConversation',
	'chatConversationMembers',
	'chatMessages',
	'chatPins',
	'chatThreads',
	'chatThread'
];

function setup() {
	const caller = { tenantId: 'ten', organizationId: 'org', userId: 'u1', employeeId: 'e1', canManage: false };
	const access = { caller: jest.fn(() => caller) };
	const conversations = {
		people: jest.fn(async () => [{ employeeId: 'e2', userId: 'u2', name: 'Ada', imageUrl: null }]),
		listCategories: jest.fn(async () => []),
		ensureDefaultChannel: jest.fn(async () => undefined),
		listMine: jest.fn(async () => ({ conversations: [], categories: [] })),
		browse: jest.fn(async () => []),
		states: jest.fn(async () => ({ states: [], threads: [] })),
		get: jest.fn(async (_caller: unknown, id: string) => ({ id, kind: 'channel' })),
		members: jest.fn(async () => [])
	};
	const messages = {
		list: jest.fn(async () => ({ messages: [], hasBefore: false, hasAfter: false })),
		pins: jest.fn(async () => []),
		followedThreads: jest.fn(async () => []),
		thread: jest.fn(async (_caller: unknown, id: string) => ({ root: { id }, messages: [], hasBefore: false, hasAfter: false }))
	};
	const resolver = new ChatResolver(access as never, conversations as never, messages as never);
	return { caller, access, conversations, messages, resolver };
}

describe('Chat GraphQL mirror', () => {
	it('the SDL composes onto the core root types, every root field has its resolver method, and no argument names a person or a tenant', () => {
		const schema = extendSchema(buildSchema(CORE_SDL), chatSchemaExtensions);
		const fields = (type: GraphQLObjectType | null | undefined) => Object.keys(type?.getFields() ?? {}).filter((name) => name !== 'ping');
		expect(fields(schema.getQueryType())).toEqual(QUERIES);
		expect(fields(schema.getMutationType())).toEqual([]);
		for (const name of QUERIES) {
			expect(typeof (ChatResolver.prototype as unknown as Record<string, unknown>)[name]).toBe('function');
		}
		const args = Object.values(schema.getQueryType()?.getFields() ?? {}).flatMap((field) => field.args.map((arg) => arg.name));
		expect(args.filter((name) => /user|employee|tenant|recipient/i.test(name))).toEqual([]);
	});

	it('is wired: each SDL root field is bound to its method as a Query', () => {
		for (const name of QUERIES) {
			const method = (ChatResolver.prototype as unknown as Record<string, object>)[name];
			expect([name, Reflect.getMetadata('graphql:resolver_type', method)]).toEqual([name, 'Query']);
			expect(Reflect.getMetadata('graphql:resolver_name', method)).toBe(name);
		}
	});

	it("carries the controllers' guards, CHAT_VIEW on the class and every field, and both feature flags", () => {
		const guards = (Reflect.getMetadata(GUARDS_METADATA, ChatResolver) as Array<{ name: string }>).map((guard) => guard.name);
		expect(guards).toEqual(['TenantPermissionGuard', 'PermissionGuard', 'FeatureFlagGuard']);
		expect(Reflect.getMetadata('permissions', ChatResolver)).toEqual([PermissionsEnum.CHAT_VIEW]);
		for (const name of QUERIES) {
			expect(Reflect.getMetadata('permissions', (ChatResolver.prototype as unknown as Record<string, object>)[name])).toEqual([PermissionsEnum.CHAT_VIEW]);
		}
		expect(Reflect.getMetadata('feature', ChatResolver)).toEqual(expect.arrayContaining(['FEATURE_GRAPHQL', FeatureEnum.FEATURE_CHAT]));
	});

	it("every id argument goes through the route's UUID pipe", () => {
		const expected: Record<string, string> = {
			chatConversation: 'id',
			chatConversationMembers: 'id',
			chatMessages: 'conversationId',
			chatPins: 'conversationId',
			chatThread: 'messageId'
		};
		for (const [name, argument] of Object.entries(expected)) {
			const args = Reflect.getMetadata(ROUTE_ARGS_METADATA, ChatResolver, name) as Record<string, { index: number; data: string; pipes: Array<{ name?: string }> }>;
			const id = Object.values(args).find((arg) => arg.index === 0);
			expect([name, id?.data, id?.pipes.map((pipe) => pipe.name)]).toEqual([name, argument, ['UUIDValidationPipe']]);
		}
		expect(() => new UUIDValidationPipe().transform('not-an-id', {} as never)).toThrow('valid uuid');
	});

	it('the reads reach the service methods of their routes, as the caller', async () => {
		const { caller, conversations, messages, resolver } = setup();
		expect(await resolver.chatPeople()).toHaveLength(1);
		expect(conversations.people).toHaveBeenCalledWith(caller);
		await resolver.chatCategories();
		expect(conversations.listCategories).toHaveBeenCalledWith(caller);
		await resolver.chatConversations();
		expect(conversations.ensureDefaultChannel).toHaveBeenCalledWith(caller);
		expect(conversations.listMine).toHaveBeenCalledWith(caller);
		await resolver.chatBrowseConversations();
		expect(conversations.browse).toHaveBeenCalledWith(caller);
		await resolver.chatStates();
		expect(conversations.states).toHaveBeenCalledWith(caller);
		expect(await resolver.chatConversation(CONVERSATION_ID)).toMatchObject({ id: CONVERSATION_ID });
		expect(conversations.get).toHaveBeenCalledWith(caller, CONVERSATION_ID);
		await resolver.chatConversationMembers(CONVERSATION_ID);
		expect(conversations.members).toHaveBeenCalledWith(caller, CONVERSATION_ID);
		await resolver.chatPins(CONVERSATION_ID);
		expect(messages.pins).toHaveBeenCalledWith(caller, CONVERSATION_ID);
		await resolver.chatThreads();
		expect(messages.followedThreads).toHaveBeenCalledWith(caller);
	});

	it("the page queries carry the route's query, validated as the route validates it", async () => {
		const { caller, messages, resolver } = setup();
		await resolver.chatMessages(CONVERSATION_ID, { before: MESSAGE_ID, limit: 20 });
		expect(messages.list).toHaveBeenCalledWith(caller, CONVERSATION_ID, expect.objectContaining({ before: MESSAGE_ID, limit: 20 }));
		await resolver.chatMessages(CONVERSATION_ID, null);
		expect(messages.list).toHaveBeenLastCalledWith(caller, CONVERSATION_ID, expect.not.objectContaining({ before: expect.anything() }));
		expect(await resolver.chatThread(MESSAGE_ID, { after: CONVERSATION_ID })).toMatchObject({ root: { id: MESSAGE_ID } });
		expect(messages.thread).toHaveBeenCalledWith(caller, MESSAGE_ID, expect.objectContaining({ after: CONVERSATION_ID }));
		// A limit past the page cap, or a cursor that is no id, is the route's 400 — before the service.
		await expect(resolver.chatMessages(CONVERSATION_ID, { limit: 1000 })).rejects.toBeInstanceOf(BadRequestException);
		await expect(resolver.chatThread(MESSAGE_ID, { before: 'not-an-id' as never })).rejects.toBeInstanceOf(BadRequestException);
		expect(messages.list).toHaveBeenCalledTimes(2);
		expect(messages.thread).toHaveBeenCalledTimes(1);
		// Members the DTO does not declare are dropped, as the route's whitelist does.
		expect(await validatedChatInput(ChatMessagesQueryDTO, { limit: 5, extra: 'x' } as never)).toEqual(expect.not.objectContaining({ extra: expect.anything() }));
	});
});
