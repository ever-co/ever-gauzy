/**
 * 🛑 This import must stay FIRST, before any import that pulls a core service or controller — see
 * `channel.controller.spec.ts` for the cycle it avoids: an entity decorator is undefined when the
 * entity applies it if the graph is entered through the validators rather than through the entities.
 */
import '../core/entities/internal';

import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { ExecutionContext, NotFoundException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { MODULE_METADATA } from '@nestjs/common/constants';
import { buildSchema, printSchema } from 'graphql';
import { IUserUiPreferences, PermissionsEnum } from '@gauzy/contracts';
import { FEATURE_METADATA, PERMISSIONS_METADATA } from '@gauzy/constants';
import { CursorCodec } from '../api/cursor';
import { FeatureFlagGuard, PermissionGuard, TenantPermissionGuard } from '../shared/guards';
import { UserController } from './user.controller';
import { UserModule } from './user.module';
import { UserResolver } from './user.resolver';
import { UserService } from './user.service';
import { UserCreateCommand, UserDeleteCommand } from './commands';

/**
 * The account over GraphQL.
 *
 * The delivered REST routes serve a user list, one account, the count, the current account, an account
 * by address, the creation, the edit, the removal, the tenant reset, the three preference writes and
 * the two lifecycle moves. This suite pins the half of the two-protocol doctrine that is easy to get
 * quietly wrong:
 *
 * - every one of those capabilities is a root field of the one composed schema, and the list is a
 *   connection with the platform's own cursor codec behind it, so a cursor obtained over REST resumes
 *   here and a refusal is the query protocol's own code;
 * - every field reaches the same service method, or dispatches the same command, that the REST route
 *   reaches, so a client does not choose a better surface by choosing a protocol;
 * - **the guard chain and the permission are the route's own, read from the controller's metadata** —
 *   including `me`, whose route carries neither, and the four routes whose permissions differ from one
 *   another;
 * - **the six columns the delivered read excludes are not members of the type, and none of them is
 *   filterable or sortable either**: the schema is not a second projection that answers what REST
 *   drops, and it is not a way to ask after the same fact sideways;
 * - no relation is a field, and each one is carried as the identifier that always travels.
 */

const TENANT = '00000000-0000-4000-8000-000000000001';
const ORGANIZATION = '00000000-0000-4000-8000-000000000002';
const ROLE = '00000000-0000-4000-8000-000000000003';
const FIRST = '00000000-0000-4000-8000-000000000050';
const SECOND = '00000000-0000-4000-8000-000000000051';

/** The rows a scripted service answers with, in the order the delivered list read returns them. */
const ROWS = [
	{
		id: FIRST,
		tenantId: TENANT,
		firstName: 'Ada',
		lastName: 'Lovelace',
		name: 'Ada Lovelace',
		email: 'ada@example.com',
		username: 'ada',
		phoneNumber: '+440000000000',
		timeZone: 'Europe/London',
		timeFormat: '12_HOURS',
		imageUrl: 'https://example.test/ada.png',
		preferredLanguage: 'en',
		preferredComponentLayout: 'TABLE',
		uiPreferences: { aiChat: { expanded: true } },
		lastLoginAt: new Date('2026-03-02T10:00:00.000Z'),
		isEmailVerified: true,
		roleId: ROLE,
		isActive: true,
		createdAt: new Date('2026-03-01T10:00:00.000Z'),
		updatedAt: new Date('2026-03-01T10:00:00.000Z')
	},
	{
		id: SECOND,
		tenantId: TENANT,
		firstName: 'Grace',
		lastName: 'Hopper',
		name: 'Grace Hopper',
		email: 'grace@example.com',
		username: 'grace',
		timeZone: 'America/New_York',
		timeFormat: '24_HOURS',
		imageUrl: 'https://example.test/grace.png',
		preferredLanguage: 'en',
		preferredComponentLayout: 'CARDS_GRID',
		lastLoginAt: new Date('2026-02-02T10:00:00.000Z'),
		isEmailVerified: false,
		roleId: null,
		isActive: true,
		createdAt: new Date('2026-02-01T10:00:00.000Z'),
		updatedAt: new Date('2026-02-01T10:00:00.000Z')
	}
];

/** The resolver, over a scripted service, a scripted reset service and a scripted command bus. */
function surfaces() {
	const userService = {
		findAll: jest.fn().mockResolvedValue({ items: ROWS, total: ROWS.length }),
		findOneByIdString: jest.fn().mockResolvedValue(ROWS[0]),
		getUserByEmail: jest.fn().mockResolvedValue(ROWS[0]),
		findMeUser: jest.fn().mockResolvedValue(ROWS[0]),
		countBy: jest.fn().mockResolvedValue(ROWS.length),
		updateProfile: jest.fn().mockResolvedValue(ROWS[0]),
		updatePreferredLanguage: jest.fn().mockResolvedValue({ affected: 1 }),
		updatePreferredComponentLayout: jest.fn().mockResolvedValue({ affected: 1 }),
		updateUiPreferences: jest.fn().mockResolvedValue({ aiChat: { expanded: true } } as IUserUiPreferences),
		softRemove: jest.fn().mockResolvedValue({ ...ROWS[0], deletedAt: new Date('2026-04-01T10:00:00.000Z') }),
		softRecover: jest.fn().mockResolvedValue({ ...ROWS[0], deletedAt: null })
	};
	const factoryResetService = { reset: jest.fn().mockResolvedValue({ id: ORGANIZATION }) };
	const commandBus = { execute: jest.fn().mockResolvedValue(ROWS[0]) };

	return {
		userService,
		factoryResetService,
		commandBus,
		resolver: new UserResolver(userService as never, factoryResetService as never, commandBus as never)
	};
}

/** Whether an HTTP failure is a refusal rather than a miss. */
function isRefusal(error: unknown): boolean {
	return (
		error instanceof Error &&
		'getStatus' in error &&
		typeof (error as { getStatus(): number }).getStatus === 'function' &&
		(error as { getStatus(): number }).getStatus() >= 400 &&
		(error as { getStatus(): number }).getStatus() !== 404
	);
}

/**
 * The composed schema, as text: the domain's own documents plus every kernel and domain document the
 * boot loader globs, which is what makes a reference from this domain to another one resolvable.
 */
function composedSchema(): string {
	const root = join(__dirname, '..');
	const documents: string[] = [];

	const walk = (directory: string): void => {
		for (const entry of readdirSync(directory, { withFileTypes: true })) {
			const path = join(directory, entry.name);

			if (entry.isDirectory()) {
				walk(path);
			} else if (entry.name.endsWith('.gql') && directory.endsWith('schema')) {
				documents.push(readFileSync(path, 'utf8'));
			}
		}
	};

	walk(root);

	return documents.join('\n');
}

/** The schema, built once: the composition itself is asserted by the composition check, not here. */
const schema = buildSchema(composedSchema());

/** The schema as text, printed once. */
const printed = printSchema(schema);

/** The fields one root operation type declares, as a client reads them. */
function rootFields(operation: 'Query' | 'Mutation'): string[] {
	const root = schema.getType(operation) as { getFields(): Record<string, unknown> } | undefined;

	return Object.keys(root?.getFields() ?? {});
}

/** The members of one object type this schema declares, as a client reads them. */
function objectFields(name: string): string[] {
	const type = schema.getType(name) as { getFields(): Record<string, unknown> } | undefined;

	return Object.keys(type?.getFields() ?? {});
}

/**
 * The root fields this domain contributes.
 *
 * Ownership is stated rather than pattern-matched loosely, for two reasons: the sibling membership
 * resource's fields — `userOrganizations`, `userOrganizationOrganizationsCount` and the rest — also
 * spell `user` and belong to that surface rather than this one, and the two preference writes spell the
 * preference rather than the resource. What is left is the account's own vocabulary, the two fields
 * this resource names for a route rather than for a row, and those two writes.
 */
function ownedRootFields(operation: 'Query' | 'Mutation'): string[] {
	return rootFields(operation)
		.filter(
			(field) =>
				field === 'me' ||
				field === 'factoryReset' ||
				/^updatePreferred/.test(field) ||
				(/user/i.test(field) && !/userorganization/i.test(field))
		)
		.sort();
}

/** The arguments one root field declares, in the order a client states them. */
function fieldArgs(operation: 'Query' | 'Mutation', field: string): string[] {
	const root = schema.getType(operation) as
		| { getFields(): Record<string, { args: readonly { name: string }[] }> }
		| undefined;

	return (root?.getFields()?.[field]?.args ?? []).map((argument) => argument.name);
}

/** The printed body of one object type, so a member it must not carry can be asserted absent. */
function typeBody(name: string): string {
	return printed.match(new RegExp(`type ${name} \\{([\\s\\S]*?)\\n\\}`))?.[1] ?? '';
}

/** The printed body of one input type, so a member it must not carry can be asserted absent. */
function inputBody(name: string): string {
	return printed.match(new RegExp(`input ${name} \\{([\\s\\S]*?)\\n\\}`))?.[1] ?? '';
}

/** The handlers of the controller, as functions, inherited ones included. */
function handlersOf(controller: typeof UserController): Record<string, object> {
	return controller.prototype as unknown as Record<string, object>;
}

/**
 * The permission one route runs under: what its handler states, else what its controller states.
 *
 * This is the rule the guards themselves apply — the reflector's `getAllAndOverride` over
 * `[handler, class]` — restated here, so a field is held to its own route's metadata rather than to a
 * second copy of the same list written out in this file.
 */
function permissionOfRoute(controller: typeof UserController, handler: string): unknown {
	return (
		Reflect.getMetadata(PERMISSIONS_METADATA, handlersOf(controller)[handler]) ??
		Reflect.getMetadata(PERMISSIONS_METADATA, controller)
	);
}

/**
 * The guards one route actually runs under: the controller's chain followed by whatever the handler
 * states of its own, which is the order the guard context creator concatenates them in.
 */
function guardsOfRoute(controller: typeof UserController, handler: string): unknown[] {
	const declared = Reflect.getMetadata('__guards__', controller) ?? [];
	const restated = Reflect.getMetadata('__guards__', handlersOf(controller)[handler]) ?? [];

	return Array.from(new Set([...declared, ...restated]));
}

/** The fields of the resolver, as functions. */
function fieldsOf(resolver: typeof UserResolver): Record<string, object> {
	return resolver.prototype as unknown as Record<string, object>;
}

/** The permission one resolver field runs under, by the same override rule. */
function permissionOfField(field: string): unknown {
	return (
		Reflect.getMetadata(PERMISSIONS_METADATA, fieldsOf(UserResolver)[field]) ??
		Reflect.getMetadata(PERMISSIONS_METADATA, UserResolver)
	);
}

/** The guards one resolver field runs under, the class chain first. */
function guardsOfField(field: string): unknown[] {
	const declared = Reflect.getMetadata('__guards__', UserResolver) ?? [];
	const restated = Reflect.getMetadata('__guards__', fieldsOf(UserResolver)[field]) ?? [];

	return Array.from(new Set([...declared, ...restated]));
}

describe('UserResolver — the SDL declares the capabilities the REST routes serve', () => {
	it('declares the list, the two look-ups, the current account and the count', () => {
		expect(rootFields('Query')).toEqual(
			expect.arrayContaining(['users', 'user', 'userByEmail', 'me', 'userCount'])
		);
	});

	it('declares one mutation per delivered write route', () => {
		expect(rootFields('Mutation')).toEqual(
			expect.arrayContaining([
				'createUser',
				'updateUser',
				'updatePreferredLanguage',
				'updatePreferredComponentLayout',
				'updateUserUiPreferences',
				'deleteUser',
				'softDeleteUser',
				'recoverUser',
				'factoryReset'
			])
		);
	});

	it('declares every route this resource serves, and the paginated list only as the connection', () => {
		// The controller serves thirteen routes of its own and inherits two. Fourteen of them are root
		// fields; `GET /pagination` is not one, because it answers the same rows under the same filters
		// as the list and the page is what the connection answers with.
		expect(ownedRootFields('Query')).toEqual(['me', 'user', 'userByEmail', 'userCount', 'users']);
		expect(ownedRootFields('Mutation')).toEqual([
			'createUser',
			'deleteUser',
			'factoryReset',
			'recoverUser',
			'softDeleteUser',
			'updatePreferredComponentLayout',
			'updatePreferredLanguage',
			'updateUser',
			'updateUserUiPreferences'
		]);
		expect(rootFields('Query')).not.toEqual(expect.arrayContaining(['usersPagination', 'userPagination']));

		// Every field above names a handler that exists on the controller, inherited ones included.
		for (const handler of [
			'findAll',
			'findById',
			'findByEmail',
			'findMe',
			'getCount',
			'create',
			'update',
			'delete',
			'factoryReset',
			'updatePreferredLanguage',
			'updatePreferredComponentLayout',
			'updateUiPreferences',
			'softRemove',
			'softRecover'
		]) {
			expect(typeof handlersOf(UserController)[handler]).toBe('function');
		}
	});

	it('declares the connection, its edges, its filters and its sorts', () => {
		expect(printed).toMatch(
			/type UserConnection \{\s*nodes: \[User!\]!\s*edges: \[UserEdge!\]!\s*totalCount: Int!\s*pageInfo: PageInfo!\s*\}/
		);
		expect(printed).toMatch(/type UserEdge \{\s*node: User!\s*cursor: String!\s*\}/);
		expect(printed).toMatch(/input UserFilter \{/);
		expect(printed).toMatch(/input UserSort \{/);
		expect(printed).toMatch(/enum UserSortField \{/);
	});

	it('answers the count through a nullable field of its own and takes no argument it cannot honour', () => {
		// `GET /count` answers a bare number, which is not a connection and is not the connection's
		// `totalCount`: that total is the count of the rows the connection narrowed to, while the
		// count route counts the caller's own rows. Nullable, because an aggregate the resource has no
		// answer for must not be answered as a zero.
		expect(printed).toMatch(/userCount: Int\n/);
		expect(printed).not.toMatch(/userCount: Int!/);
		expect(fieldArgs('Query', 'userCount')).toEqual([]);

		expect(fieldArgs('Query', 'users')).toEqual([
			'filter',
			'sort',
			'page',
			'first',
			'after',
			'last',
			'before',
			'limit',
			'offset'
		]);
	});

	it('offers the current account as a non-null field, and the look-ups as nullable ones', () => {
		// The credential that reached `me` is the proof the row exists, so a miss is not an outcome this
		// field has; the identifier and the address look-ups both can miss, and answer null when they do.
		expect(printed).toMatch(/me: User!\n/);
		expect(printed).toMatch(/user\(id: ID!\): User\n/);
		expect(printed).toMatch(/userByEmail\(email: String!\): User\n/);
	});

	it('offers no argument it cannot honour', () => {
		// The delivered list read answers live rows only, so the connection does not offer `withDeleted`.
		expect(printed).not.toMatch(/users\([^)]*withDeleted/);
		// `GET /me` accepts `includeEmployee`, `includeOrganization` and `relations`; the members they
		// add are a relation this schema declares no type for, so no argument here promises one.
		expect(printed).toMatch(/me: User!\n/);
		expect(fieldArgs('Query', 'me')).toEqual([]);
	});
});

describe('UserResolver — which members the surface exposes, and which it refuses', () => {
	it('carries the members the delivered answer carries', () => {
		expect(objectFields('User')).toEqual(
			expect.arrayContaining([
				'id',
				'tenantId',
				'thirdPartyId',
				'firstName',
				'lastName',
				'name',
				'email',
				'phoneNumber',
				'username',
				'timeZone',
				'timeFormat',
				'imageUrl',
				'imageId',
				'preferredLanguage',
				'preferredComponentLayout',
				'uiPreferences',
				'lastLoginAt',
				'isEmailVerified',
				'roleId',
				'defaultTeamId',
				'lastTeamId',
				'defaultOrganizationId',
				'lastOrganizationId',
				'isActive',
				'isArchived',
				'deletedAt',
				'createdAt',
				'updatedAt'
			])
		);
	});

	it('refuses every credential and token column the delivered read excludes', () => {
		const body = typeBody('User');

		// The six the entity marks `@Exclude({ toPlainOnly: true })`. A member for any of them would be
		// a second projection of the same row — one that answers what the delivered one drops.
		for (const member of ['hash', 'refreshToken', 'code', 'codeExpireAt', 'emailToken', 'emailVerifiedAt']) {
			expect(body).not.toMatch(new RegExp(`\\b${member}:`));
		}

		// What is carried instead is the derived fact, which says whether the address was verified
		// without saying when or with which token.
		expect(body).toMatch(/isEmailVerified: Boolean/);
	});

	it('carries no relation object, and carries the identifier each relation reports instead', () => {
		const body = typeBody('User');

		// The delivered read joins the relations its caller names and this surface's read names none, so
		// a relation member would be absent on every row answered here.
		for (const member of [
			'role:',
			'image:',
			'defaultTeam:',
			'lastTeam:',
			'defaultOrganization:',
			'lastOrganization:',
			'tags:',
			'organizations:',
			'invites:',
			'socialAccounts:',
			'employee:',
			'candidate:',
			'payments:'
		]) {
			expect(body).not.toContain(member);
		}

		// What always travels is the foreign key, and the comment beside each names where the row behind
		// it is read from.
		for (const member of [
			'roleId: ID',
			'imageId: ID',
			'defaultTeamId: ID',
			'lastTeamId: ID',
			'defaultOrganizationId: ID',
			'lastOrganizationId: ID'
		]) {
			expect(body).toMatch(new RegExp(member.replace(' ', '\\s*')));
		}
	});

	it('refuses the three audit-user stamps, which would put three more accounts on every row', () => {
		const body = typeBody('User');

		for (const member of ['createdByUserId', 'updatedByUserId', 'deletedByUserId']) {
			expect(body).not.toContain(member);
		}
	});

	it('carries the derived name and the verification flag as filterable members, and no excluded column', () => {
		const filter = inputBody('UserFilter');

		// Both are merged onto the row by the delivered reader before the connection sees it, which is
		// what makes narrowing by either a question the read can answer.
		expect(filter).toMatch(/name: StringFilter/);
		expect(filter).toMatch(/isEmailVerified: BooleanFilter/);

		// A filter on an excluded column would answer the same disclosure the read refuses, asked
		// sideways.
		for (const member of ['hash', 'refreshToken', 'code', 'codeExpireAt', 'emailToken', 'emailVerifiedAt']) {
			expect(filter).not.toMatch(new RegExp(`\\b${member}:`));
		}
	});

	it('carries the password the edit route accepts as an input member only', () => {
		// The delivered body accepts the new password under this name and the service hashes it before
		// the write, so the capability is mirrored — and it is mirrored on the way in only.
		expect(inputBody('UpdateUserInput')).toMatch(/hash: String/);
		expect(inputBody('CreateUserInput')).not.toMatch(/\bhash:/);
		expect(typeBody('User')).not.toMatch(/\bhash:/);
	});

	it('declares the write inputs the two write mutations take', () => {
		expect(printed).toMatch(/input CreateUserInput \{/);
		expect(printed).toMatch(/input UpdateUserInput \{/);
		// The address identifies an account, so the create states it and the edit does not require it.
		expect(inputBody('CreateUserInput')).toMatch(/email: String!/);
		expect(inputBody('UpdateUserInput')).toMatch(/id: ID!/);
	});
});

describe('UserResolver — the connection contract', () => {
	it('answers the list with nodes, edges, a total and the boundary cursors', async () => {
		const { resolver, userService } = surfaces();

		const connection = await resolver.users(undefined, undefined, undefined, 20);

		expect(userService.findAll).toHaveBeenCalledWith({});
		expect(connection.nodes).toHaveLength(2);
		expect(connection.totalCount).toBe(2);
		expect(connection.pageInfo.startCursor).toBe(connection.edges[0].cursor);
		expect(connection.pageInfo.endCursor).toBe(connection.edges[1].cursor);
		expect(connection.pageInfo.hasNextPage).toBe(false);
		// The cursor is the platform's own codec, so the same cursor is valid on the REST surface.
		expect(CursorCodec.decode(connection.edges[0].cursor).id).toBe(FIRST);
	});

	it('orders newest first when the caller states none', async () => {
		const { resolver } = surfaces();

		const connection = await resolver.users();

		expect(connection.nodes.map((node) => node.id)).toEqual([FIRST, SECOND]);
	});

	it('narrows by the fields the filter declares, including the two the reader merges', async () => {
		const { resolver } = surfaces();

		const byEmail = await resolver.users({ email: { eq: 'grace@example.com' } });
		expect(byEmail.nodes.map((node) => node.id)).toEqual([SECOND]);

		const byName = await resolver.users({ name: { ilike: 'ada%' } });
		expect(byName.nodes.map((node) => node.id)).toEqual([FIRST]);

		const verified = await resolver.users({ isEmailVerified: { eq: true } });
		expect(verified.nodes.map((node) => node.id)).toEqual([FIRST]);

		const byRole = await resolver.users({ roleId: { isNull: true } });
		expect(byRole.nodes.map((node) => node.id)).toEqual([SECOND]);
	});

	it('orders by the keys the sort enum offers', async () => {
		const { resolver } = surfaces();

		const byEmail = await resolver.users(undefined, [{ field: 'email', direction: 'DESC' }]);
		expect(byEmail.nodes.map((node) => node.id)).toEqual([SECOND, FIRST]);

		const byLastName = await resolver.users(undefined, [{ field: 'lastName', direction: 'ASC' }]);
		expect(byLastName.nodes.map((node) => node.id)).toEqual([SECOND, FIRST]);
	});

	it('resumes a walk from an opaque cursor, forwards and backwards', async () => {
		const { resolver } = surfaces();
		const first = await resolver.users(undefined, undefined, undefined, 1);

		expect(first.nodes.map((node) => node.id)).toEqual([FIRST]);

		const second = await resolver.users(undefined, undefined, {
			first: 1,
			after: first.pageInfo.endCursor ?? undefined
		});

		expect(second.nodes.map((node) => node.id)).toEqual([SECOND]);
		expect(second.pageInfo.hasPreviousPage).toBe(true);

		const all = await resolver.users(undefined, undefined, undefined, 20);
		const last = await resolver.users(undefined, undefined, { last: 1, before: all.edges[1].cursor });

		expect(last.nodes.map((node) => node.id)).toEqual([FIRST]);
		expect(last.pageInfo.hasNextPage).toBe(true);
	});

	it('refuses a sort field the resource does not declare, with the query protocol’s own code', async () => {
		const { resolver } = surfaces();

		const error = await resolver
			.users(undefined, [{ field: 'hash', direction: 'ASC' }] as never)
			.catch((thrown) => thrown);

		expect(isRefusal(error)).toBe(true);
		expect((error as Error).message).toContain('QUERY_SORT_NOT_ALLOWED');
		// The refusal names the fields the resource does offer, and no excluded column is among them.
		expect((error as Error).message).not.toContain('hash,');
	});

	it('refuses a filter field the resource does not declare', async () => {
		const { resolver } = surfaces();

		const error = await resolver.users({ refreshToken: { eq: 'x' } }).catch((thrown) => thrown);

		expect(isRefusal(error)).toBe(true);
		expect((error as Error).message).toContain('QUERY_UNKNOWN_FILTER_FIELD');
	});

	it('refuses both pagination styles at once rather than silently preferring one', async () => {
		const { resolver } = surfaces();

		const error = await resolver
			.users(undefined, undefined, undefined, 5, undefined, undefined, undefined, 5)
			.catch((thrown) => thrown);

		expect(isRefusal(error)).toBe(true);
		expect((error as Error).message).toContain('QUERY_NESTING_LIMIT_EXCEEDED');
	});

	it('caps the page rather than answering every account', async () => {
		const { resolver } = surfaces();

		const error = await resolver.users(undefined, undefined, undefined, 500).catch((thrown) => thrown);

		expect(isRefusal(error)).toBe(true);
		expect((error as Error).message).toContain('QUERY_PAGE_LIMIT_EXCEEDED');
	});
});

describe('UserResolver — one concept, two protocols, the same operations', () => {
	it('reads one account through the same service method the REST route calls', async () => {
		const { resolver, userService } = surfaces();

		expect(await resolver.user(FIRST)).toBe(ROWS[0]);
		expect(userService.findOneByIdString).toHaveBeenCalledWith(FIRST);
	});

	it('answers null for an account that is not there, which is the REST route’s 404 in this vocabulary', async () => {
		const { resolver, userService } = surfaces();
		userService.findOneByIdString.mockRejectedValueOnce(new NotFoundException());

		expect(await resolver.user(SECOND)).toBeNull();
	});

	it('reads one account by address through the same service method the REST route calls', async () => {
		const { resolver, userService } = surfaces();

		expect(await resolver.userByEmail('ada@example.com')).toBe(ROWS[0]);
		expect(userService.getUserByEmail).toHaveBeenCalledWith('ada@example.com');
	});

	it('answers null for an address no account holds, which is what the delivered read answers', async () => {
		const { resolver, userService } = surfaces();
		userService.getUserByEmail.mockResolvedValueOnce(null);

		expect(await resolver.userByEmail('nobody@example.com')).toBeNull();
	});

	it('reads the caller’s own account through the same service method `GET /me` calls, with no options', async () => {
		const { resolver, userService } = surfaces();

		expect(await resolver.me()).toBe(ROWS[0]);
		// `relations`, `includeEmployee` and `includeOrganization` select members this surface's type
		// does not carry, so the read runs with the route's own defaults.
		expect(userService.findMeUser).toHaveBeenCalledWith({});
	});

	it('counts through the same service method the count route calls, with the route’s own options', async () => {
		const { resolver, userService } = surfaces();

		expect(await resolver.userCount()).toBe(2);
		expect(userService.countBy).toHaveBeenCalledWith();
	});

	it('files an account through the command the REST route dispatches', async () => {
		const { resolver, commandBus } = surfaces();

		await resolver.createUser({ email: 'ada@example.com', firstName: 'Ada', roleId: ROLE });

		const command = commandBus.execute.mock.calls[0][0];
		expect(command).toBeInstanceOf(UserCreateCommand);
		expect(command.input).toEqual({ email: 'ada@example.com', firstName: 'Ada', roleId: ROLE });
	});

	it('edits an account through the same service method the REST route calls', async () => {
		const { resolver, userService } = surfaces();

		await resolver.updateUser({ id: FIRST, firstName: 'Grace', hash: 'a-long-enough-secret' });

		// The identifier is carried in both places the delivered route carries it — the path and the
		// body — because the service reads the body's and treats the path's as authoritative.
		expect(userService.updateProfile).toHaveBeenCalledWith(
			FIRST,
			expect.objectContaining({ id: FIRST, firstName: 'Grace', hash: 'a-long-enough-secret' })
		);
	});

	it('writes the caller’s own preference for the language, and reads the row back', async () => {
		const { resolver, userService } = surfaces();

		expect(await resolver.updatePreferredLanguage('fr')).toBe(ROWS[0]);
		expect(userService.updatePreferredLanguage).toHaveBeenCalledWith('fr');
		// The delivered route answers the store's update result, which is not a row.
		expect(userService.findOneByIdString).toHaveBeenCalled();
	});

	it('writes the caller’s own preference for the layout, and reads the row back', async () => {
		const { resolver, userService } = surfaces();

		expect(await resolver.updatePreferredComponentLayout('CARDS_GRID')).toBe(ROWS[0]);
		expect(userService.updatePreferredComponentLayout).toHaveBeenCalledWith('CARDS_GRID');
		expect(userService.findOneByIdString).toHaveBeenCalled();
	});

	it('merges a per-feature patch through the same service method the REST route calls', async () => {
		const { resolver, userService } = surfaces();

		expect(await resolver.updateUserUiPreferences({ aiChat: { expanded: true } })).toEqual({
			aiChat: { expanded: true }
		});
		expect(userService.updateUiPreferences).toHaveBeenCalledWith({ aiChat: { expanded: true } });
	});

	it('removes an account through the command the REST route dispatches', async () => {
		const { resolver, commandBus } = surfaces();

		expect(await resolver.deleteUser(FIRST)).toBe(true);

		const command = commandBus.execute.mock.calls[0][0];
		expect(command).toBeInstanceOf(UserDeleteCommand);
		expect(command.userId).toBe(FIRST);
	});

	it('withdraws and restores an account through the same two service methods', async () => {
		const { resolver, userService } = surfaces();

		const withdrawn = await resolver.softDeleteUser(FIRST);
		expect(userService.softRemove).toHaveBeenCalledWith(FIRST);
		expect(withdrawn.deletedAt).toBeInstanceOf(Date);

		const restored = await resolver.recoverUser(FIRST);
		expect(userService.softRecover).toHaveBeenCalledWith(FIRST);
		expect(restored.deletedAt).toBeNull();
	});

	it('resets the caller’s data through the same service the REST route calls', async () => {
		const { resolver, factoryResetService } = surfaces();

		expect(await resolver.factoryReset()).toBe(true);
		expect(factoryResetService.reset).toHaveBeenCalledWith();
	});

	it('surfaces a refusal as a 4xx that is not a 404', async () => {
		const { resolver, commandBus } = surfaces();
		const refusal = new Error('You are not allowed to delete this user.');

		commandBus.execute.mockRejectedValueOnce(refusal);

		await expect(resolver.deleteUser(FIRST)).rejects.toBe(refusal);
	});
});

/**
 * Every root field and the delivered route it mirrors.
 *
 * The two surfaces are one capability stated twice, so the guard chain and the permission of a field
 * are read from the field and from the route's own metadata and compared, rather than restated here: a
 * table of permission names would agree with the resolver while disagreeing with the controller, which
 * is the failure this half of the doctrine exists to catch.
 */
const ROUTE_PARITY: ReadonlyArray<{ field: string; route: string }> = [
	{ field: 'users', route: 'findAll' },
	{ field: 'user', route: 'findById' },
	{ field: 'userByEmail', route: 'findByEmail' },
	{ field: 'me', route: 'findMe' },
	{ field: 'userCount', route: 'getCount' },
	{ field: 'createUser', route: 'create' },
	{ field: 'updateUser', route: 'update' },
	{ field: 'updatePreferredLanguage', route: 'updatePreferredLanguage' },
	{ field: 'updatePreferredComponentLayout', route: 'updatePreferredComponentLayout' },
	{ field: 'updateUserUiPreferences', route: 'updateUiPreferences' },
	{ field: 'deleteUser', route: 'delete' },
	{ field: 'softDeleteUser', route: 'softRemove' },
	{ field: 'recoverUser', route: 'softRecover' },
	{ field: 'factoryReset', route: 'factoryReset' }
];

describe('UserResolver — the guard stack and the permission are the route’s, field by field', () => {
	it('states no class-level guard beyond the gate and no class-level permission, as the controller does', () => {
		const controllerGuards = Reflect.getMetadata('__guards__', UserController) ?? [];
		const resolverGuards = Reflect.getMetadata('__guards__', UserResolver) ?? [];

		// The delivered controller carries neither guard nor permission at class level: it states both
		// per route, with different permissions on different routes. A resolver that carried one scope
		// for all of them would be a second, wrong answer to the same question.
		expect(controllerGuards).toEqual([]);
		expect(Reflect.getMetadata(PERMISSIONS_METADATA, UserController)).toBeUndefined();
		expect(Reflect.getMetadata(PERMISSIONS_METADATA, UserResolver)).toBeUndefined();
		// The gate is the one thing appended to the chain, and it is on the class so every field is
		// behind it.
		expect(resolverGuards).toEqual([FeatureFlagGuard]);
	});

	it('guards every route with the protocol guards the routes themselves state', () => {
		// A sample of the three shapes the controller uses: both guards with a permission, the tenant
		// guard alone, and no guard at all.
		expect(guardsOfRoute(UserController, 'findAll')).toEqual(
			expect.arrayContaining([TenantPermissionGuard, PermissionGuard])
		);
		expect(guardsOfRoute(UserController, 'updatePreferredLanguage')).toEqual([TenantPermissionGuard]);
		expect(guardsOfRoute(UserController, 'findMe')).toEqual([]);
	});

	it.each(ROUTE_PARITY)('$field mirrors $route exactly', ({ field, route }) => {
		// A route that is not served at all would make the comparison meaningless, so the handler is
		// asserted to be there before the two readings are compared — inherited handlers included.
		expect(typeof handlersOf(UserController)[route]).toBe('function');

		// The one addition is the gate on the endpoint itself, which the route does not carry because it
		// is not a scope: every other guard of the field's chain still has to be the route's own.
		expect(guardsOfField(field).sort()).toEqual([...guardsOfRoute(UserController, route), FeatureFlagGuard].sort());
		expect(permissionOfField(field)).toEqual(permissionOfRoute(UserController, route));
	});

	it('states on each field the permission its own route declares', () => {
		expect(permissionOfField('users')).toEqual([PermissionsEnum.ORG_USERS_VIEW]);
		expect(permissionOfField('user')).toEqual([PermissionsEnum.ORG_USERS_VIEW]);
		expect(permissionOfField('userByEmail')).toEqual([PermissionsEnum.ORG_USERS_VIEW]);
		expect(permissionOfField('userCount')).toEqual([PermissionsEnum.ORG_USERS_VIEW]);
		expect(permissionOfField('createUser')).toEqual([PermissionsEnum.ORG_USERS_EDIT]);
		expect(permissionOfField('updateUser')).toEqual([PermissionsEnum.ORG_USERS_EDIT, PermissionsEnum.PROFILE_EDIT]);
		expect(permissionOfField('deleteUser')).toEqual([
			PermissionsEnum.ALL_ORG_EDIT,
			PermissionsEnum.ACCESS_DELETE_ACCOUNT
		]);
		expect(permissionOfField('factoryReset')).toEqual([PermissionsEnum.ACCESS_DELETE_ALL_DATA]);
	});

	it('states no permission on the fields whose routes state none', () => {
		// `GET /me` is authenticated by the bootstrap's global guard and scoped by the credential alone;
		// the three preference writes carry the tenant guard and nothing else; the two lifecycle moves
		// are inherited from the CRUD base, where the controller's own chain is the whole of their scope.
		for (const field of [
			'me',
			'updatePreferredLanguage',
			'updatePreferredComponentLayout',
			'updateUserUiPreferences',
			'softDeleteUser',
			'recoverUser'
		]) {
			expect(permissionOfField(field)).toBeUndefined();
		}
	});

	it('holds the two lifecycle fields to the inherited routes they mirror', () => {
		for (const [field, route] of [
			['softDeleteUser', 'softRemove'],
			['recoverUser', 'softRecover']
		] as ReadonlyArray<[string, string]>) {
			expect(Reflect.getMetadata('__guards__', handlersOf(UserController)[route])).toBeUndefined();
			expect(Reflect.getMetadata(PERMISSIONS_METADATA, handlersOf(UserController)[route])).toBeUndefined();
			expect(Reflect.getMetadata('__guards__', fieldsOf(UserResolver)[field])).toBeUndefined();
		}
	});

	it('refuses to be a second, wider path to the reset', () => {
		// The route carries the one permission that may erase a tenant's data, and the field carries the
		// same one — not the tenant guard alone, which would have made GraphQL the wider door.
		expect(permissionOfField('factoryReset')).toEqual(permissionOfRoute(UserController, 'factoryReset'));
		expect(permissionOfField('factoryReset')).toContain(PermissionsEnum.ACCESS_DELETE_ALL_DATA);
	});
});

describe('UserModule — the resolver is declared where its dependencies are reachable', () => {
	it('declares the resolver as a provider of the module that owns the service', () => {
		const providers = (Reflect.getMetadata(MODULE_METADATA.PROVIDERS, UserModule) ?? []) as unknown[];

		expect(providers).toContain(UserResolver);
		expect(providers).toContain(UserService);
	});

	it('re-exports what the resolver injects beside the service', () => {
		// A resolver is a provider of whichever module the Apollo configuration names, so a module that
		// imports this one receives what this one hands on and nothing else — which for this resolver is
		// the service, the command bus its two dispatches resolve through, and the reset service.
		const exported = (Reflect.getMetadata(MODULE_METADATA.EXPORTS, UserModule) ?? []) as unknown[];

		expect(exported).toContain(UserService);
		expect(exported.map((entry) => (entry as { name?: string })?.name)).toEqual(
			expect.arrayContaining(['CqrsModule', 'FactoryResetModule'])
		);
	});
});

/** The code the commerce catalogue declares for this surface, as the guard’s metadata carries it. */
const FEATURE_GRAPHQL = 'FEATURE_GRAPHQL';

/**
 * The gate, over a scripted cache and a scripted feature service.
 *
 * The guard under test is the real one and the metadata it reads is the metadata this resolver
 * declares, which is the point: a spec that asserted the decorator alone would keep passing if the
 * guard stopped reading that key.
 *
 * @param enabled Whether the capability is switched on for the caller’s scope.
 * @returns The guard and the service it resolves through.
 */
function gate(enabled: boolean) {
	const cache = { get: jest.fn().mockResolvedValue(null), set: jest.fn(), del: jest.fn() };
	const featureService = { isFeatureEnabled: jest.fn().mockResolvedValue(enabled) };

	return {
		guard: new FeatureFlagGuard(cache as never, new Reflector(), featureService as never),
		featureService
	};
}

/** A GraphQL execution context for one field, which is what the guard has to read without crashing. */
function graphqlContext(field: string): ExecutionContext {
	return {
		getHandler: () => (UserResolver.prototype as never)[field],
		getClass: () => UserResolver,
		getType: () => 'graphql',
		getArgByIndex: () => ({ fieldName: field })
	} as unknown as ExecutionContext;
}

describe('UserResolver — a capability that is switched off is not served', () => {
	it('declares the capability the commerce catalogue declares for this surface, on the class', () => {
		// One statement, read by the guard with `getAllAndOverride` over the handler and then the class,
		// so every field is behind it — including the ones that state no guard of their own, which is
		// what makes the gate the whole of their scope.
		expect(Reflect.getMetadata(FEATURE_METADATA, UserResolver)).toBe(FEATURE_GRAPHQL);
		expect(Reflect.getMetadata('__guards__', UserResolver)).toContain(FeatureFlagGuard);
	});

	it('refuses a field whose capability is switched off, and names the field it refused', async () => {
		const { guard, featureService } = gate(false);

		const refusal = await guard.canActivate(graphqlContext('users')).catch((thrown) => thrown);

		// The code the guard resolved is the one this resolver declared, not a second copy of it.
		expect(featureService.isFeatureEnabled).toHaveBeenCalledWith(FEATURE_GRAPHQL);
		expect(refusal).toBeInstanceOf(NotFoundException);
		// A disabled capability answers the way a missing one does, and says which field was refused.
		expect((refusal as Error).message).toContain('users');
		expect((refusal as NotFoundException).getStatus()).toBe(404);
	});

	it('refuses the unguarded field as well, which is what makes the gate carry its own scope', async () => {
		const { guard } = gate(false);

		const refusal = await guard.canActivate(graphqlContext('me')).catch((thrown) => thrown);

		expect(refusal).toBeInstanceOf(NotFoundException);
		expect((refusal as Error).message).toContain('me');
	});

	it('serves the field once the capability is switched on', async () => {
		const { guard } = gate(true);

		await expect(guard.canActivate(graphqlContext('users'))).resolves.toBe(true);
	});
});
