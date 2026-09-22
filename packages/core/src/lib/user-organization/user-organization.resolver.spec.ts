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
import { FEATURE_METADATA, PERMISSIONS_METADATA } from '@gauzy/constants';
import { CursorCodec } from '../api/cursor';
import { FeatureFlagGuard, PermissionGuard, TenantPermissionGuard } from '../shared/guards';
import { UserOrganizationController } from './user-organization.controller';
import { UserOrganizationModule } from './user-organization.module';
import { UserOrganizationResolver } from './user-organization.resolver';
import { UserOrganizationService } from './user-organization.services';
import { UserOrganizationDeleteCommand } from './commands';

/**
 * The membership over GraphQL.
 *
 * The delivered REST routes serve a membership list, one membership, the caller's own count, the count
 * of organizations the person of one membership belongs to, the creation, the edit, the removal and
 * the two lifecycle moves. This suite pins the half of the two-protocol doctrine that is easy to get
 * quietly wrong:
 *
 * - every one of those capabilities is a root field of the one composed schema, and the list is a
 *   connection with the platform's own cursor codec behind it, so a cursor obtained over REST resumes
 *   here and a refusal is the query protocol's own code;
 * - every field reaches the same service method, or dispatches the same command, that the REST route
 *   reaches — including the per-person count, which is the route's own two calls in the route's own
 *   order;
 * - **the guard is the controller's class guard and no field states a permission**, because no route
 *   of this resource carries one: a resolver that demanded one would refuse a caller the REST route
 *   serves;
 * - no relation is a field, which is also why the controller's sensitive-relations policy has nothing
 *   to strip here: the classified members belong to a relation this surface never joins.
 */

const TENANT = '00000000-0000-4000-8000-000000000001';
const ORGANIZATION = '00000000-0000-4000-8000-000000000002';
const OTHER_ORGANIZATION = '00000000-0000-4000-8000-000000000003';
const USER = '00000000-0000-4000-8000-000000000050';
const MEMBERSHIP = '00000000-0000-4000-8000-000000000060';
const OTHER_MEMBERSHIP = '00000000-0000-4000-8000-000000000061';

/** The rows a scripted service answers with, in the order the delivered list read returns them. */
const ROWS = [
	{
		id: MEMBERSHIP,
		tenantId: TENANT,
		organizationId: ORGANIZATION,
		userId: USER,
		isDefault: true,
		isActive: true,
		isArchived: false,
		createdAt: new Date('2026-03-01T10:00:00.000Z'),
		updatedAt: new Date('2026-03-01T10:00:00.000Z')
	},
	{
		id: OTHER_MEMBERSHIP,
		tenantId: TENANT,
		organizationId: OTHER_ORGANIZATION,
		userId: USER,
		isDefault: false,
		isActive: true,
		isArchived: false,
		createdAt: new Date('2026-02-01T10:00:00.000Z'),
		updatedAt: new Date('2026-02-01T10:00:00.000Z')
	}
];

/** The resolver, over a scripted service and a scripted command bus. */
function surfaces() {
	const userOrganizationService = {
		findUserOrganizations: jest.fn().mockResolvedValue({ items: ROWS, total: ROWS.length }),
		findOneByIdString: jest.fn().mockResolvedValue(ROWS[0]),
		countBy: jest.fn().mockResolvedValue(ROWS.length),
		count: jest.fn().mockResolvedValue(ROWS.length),
		create: jest.fn().mockResolvedValue(ROWS[0]),
		update: jest.fn().mockResolvedValue({ affected: 1 }),
		softRemove: jest.fn().mockResolvedValue({ ...ROWS[0], deletedAt: new Date('2026-04-01T10:00:00.000Z') }),
		softRecover: jest.fn().mockResolvedValue({ ...ROWS[0], deletedAt: null })
	};
	const commandBus = { execute: jest.fn().mockResolvedValue(ROWS[0]) };

	return {
		userOrganizationService,
		commandBus,
		resolver: new UserOrganizationResolver(userOrganizationService as never, commandBus as never)
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

/** The root fields this domain contributes, which are the ones that name the membership. */
function ownedRootFields(operation: 'Query' | 'Mutation'): string[] {
	return rootFields(operation)
		.filter((field) => /userorganization/i.test(field))
		.sort();
}

/** The members of one object type this schema declares, as a client reads them. */
function objectFields(name: string): string[] {
	const type = schema.getType(name) as { getFields(): Record<string, unknown> } | undefined;

	return Object.keys(type?.getFields() ?? {});
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
function handlersOf(controller: typeof UserOrganizationController): Record<string, object> {
	return controller.prototype as unknown as Record<string, object>;
}

/**
 * The permission one route runs under: what its handler states, else what its controller states.
 *
 * This is the rule the guards themselves apply — the reflector's `getAllAndOverride` over
 * `[handler, class]` — restated here, so a field is held to its own route's metadata rather than to a
 * second copy of the same list written out in this file.
 */
function permissionOfRoute(controller: typeof UserOrganizationController, handler: string): unknown {
	return (
		Reflect.getMetadata(PERMISSIONS_METADATA, handlersOf(controller)[handler]) ??
		Reflect.getMetadata(PERMISSIONS_METADATA, controller)
	);
}

/**
 * The guards one route actually runs under: the controller's chain followed by whatever the handler
 * states of its own, which is the order the guard context creator concatenates them in.
 */
function guardsOfRoute(controller: typeof UserOrganizationController, handler: string): unknown[] {
	const declared = Reflect.getMetadata('__guards__', controller) ?? [];
	const restated = Reflect.getMetadata('__guards__', handlersOf(controller)[handler]) ?? [];

	return Array.from(new Set([...declared, ...restated]));
}

/** The fields of the resolver, as functions. */
function fieldsOf(resolver: typeof UserOrganizationResolver): Record<string, object> {
	return resolver.prototype as unknown as Record<string, object>;
}

/** The permission one resolver field runs under, by the same override rule. */
function permissionOfField(field: string): unknown {
	return (
		Reflect.getMetadata(PERMISSIONS_METADATA, fieldsOf(UserOrganizationResolver)[field]) ??
		Reflect.getMetadata(PERMISSIONS_METADATA, UserOrganizationResolver)
	);
}

/** The guards one resolver field runs under, the class chain first. */
function guardsOfField(field: string): unknown[] {
	const declared = Reflect.getMetadata('__guards__', UserOrganizationResolver) ?? [];
	const restated = Reflect.getMetadata('__guards__', fieldsOf(UserOrganizationResolver)[field]) ?? [];

	return Array.from(new Set([...declared, ...restated]));
}

describe('UserOrganizationResolver — the SDL declares the capabilities the REST routes serve', () => {
	it('declares the connection query, the one-row query and the two counts', () => {
		expect(rootFields('Query')).toEqual(
			expect.arrayContaining([
				'userOrganizations',
				'userOrganization',
				'userOrganizationCount',
				'userOrganizationOrganizationsCount'
			])
		);
	});

	it('declares one mutation per delivered write route', () => {
		expect(rootFields('Mutation')).toEqual(
			expect.arrayContaining([
				'createUserOrganization',
				'updateUserOrganization',
				'deleteUserOrganization',
				'softDeleteUserOrganization',
				'recoverUserOrganization'
			])
		);
	});

	it('declares every route this resource serves, and the paginated list only as the connection', () => {
		// The controller serves three routes of its own and inherits seven, of which the paginated list is
		// one: that one is not a root field, because it answers the same rows under the same filters as
		// the list and the page is what the connection answers with.
		expect(ownedRootFields('Query')).toEqual([
			'userOrganization',
			'userOrganizationCount',
			'userOrganizationOrganizationsCount',
			'userOrganizations'
		]);
		expect(ownedRootFields('Mutation')).toEqual([
			'createUserOrganization',
			'deleteUserOrganization',
			'recoverUserOrganization',
			'softDeleteUserOrganization',
			'updateUserOrganization'
		]);
		expect(rootFields('Query')).not.toEqual(expect.arrayContaining(['userOrganizationsPagination']));

		// Every field above names a handler that exists on the controller, inherited ones included.
		for (const handler of [
			'findAll',
			'findById',
			'getCount',
			'findOrganizationCount',
			'create',
			'update',
			'delete',
			'softRemove',
			'softRecover'
		]) {
			expect(typeof handlersOf(UserOrganizationController)[handler]).toBe('function');
		}
	});

	it('declares the connection, its edges, its filters and its sorts', () => {
		expect(printed).toMatch(
			/type UserOrganizationConnection \{\s*nodes: \[UserOrganization!\]!\s*edges: \[UserOrganizationEdge!\]!\s*totalCount: Int!\s*pageInfo: PageInfo!\s*\}/
		);
		expect(printed).toMatch(/type UserOrganizationEdge \{\s*node: UserOrganization!\s*cursor: String!\s*\}/);
		expect(printed).toMatch(/input UserOrganizationFilter \{/);
		expect(printed).toMatch(/input UserOrganizationSort \{/);
		expect(printed).toMatch(/enum UserOrganizationSortField \{\s*createdAt\s*updatedAt\s*isDefault\s*\}/);
	});

	it('declares the write inputs the two write mutations take', () => {
		expect(printed).toMatch(/input CreateUserOrganizationInput \{/);
		expect(printed).toMatch(/input UpdateUserOrganizationInput \{/);
		// Both identifiers are required, because a membership is the pivot between exactly two rows.
		expect(inputBody('CreateUserOrganizationInput')).toMatch(/organizationId: ID!/);
		expect(inputBody('CreateUserOrganizationInput')).toMatch(/userId: ID!/);
		expect(inputBody('UpdateUserOrganizationInput')).toMatch(/id: ID!/);
	});

	it('answers each count through a field of its own and the paginated list through the connection', () => {
		// `GET /count` answers a bare number, which is not a connection and is not the connection's
		// `totalCount`: that total is the count of the rows the connection narrowed to, while the count
		// route counts the caller's own rows. Nullable, because an aggregate the resource has no answer
		// for must not be answered as a zero.
		expect(printed).toMatch(/userOrganizationCount: Int\n/);
		expect(printed).not.toMatch(/userOrganizationCount: Int!/);
		expect(fieldArgs('Query', 'userOrganizationCount')).toEqual([]);

		// The per-person count is not that count and is not a filter either: its route takes the
		// membership's identifier and answers a number, so it is a field of its own with that argument.
		expect(printed).toMatch(/userOrganizationOrganizationsCount\(userOrganizationId: ID!\): Int\n/);
		expect(fieldArgs('Query', 'userOrganizationOrganizationsCount')).toEqual(['userOrganizationId']);

		expect(fieldArgs('Query', 'userOrganizations')).toEqual([
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

	it('offers no argument it cannot honour', () => {
		// The delivered list read answers live rows only, so the connection does not offer `withDeleted`.
		expect(printed).not.toMatch(/userOrganizations\([^)]*withDeleted/);
		// The delivered list route's `includeEmployee` attaches an employee to a user the route joins;
		// this schema declares no `Employee` type, so no argument here promises one.
		expect(printed).not.toMatch(/userOrganizations\([^)]*includeEmployee/);
	});
});

describe('UserOrganizationResolver — the type carries what always travels, and no relation', () => {
	it('carries the entity’s own members', () => {
		expect(objectFields('UserOrganization')).toEqual(
			expect.arrayContaining([
				'id',
				'tenantId',
				'organizationId',
				'userId',
				'isDefault',
				'isActive',
				'isArchived',
				'deletedAt',
				'createdAt',
				'updatedAt'
			])
		);
	});

	it('carries the one fact that is not an identifier as a non-null flag', () => {
		expect(typeBody('UserOrganization')).toMatch(/isDefault: Boolean!/);
	});

	it('declares no relation field, because the delivered read joins none of them', () => {
		const body = typeBody('UserOrganization');

		// The delivered list read answers the relations its caller names and this surface's read names
		// none, so a relation member would be absent on every row answered here — and a client would read
		// `null` and conclude the membership has no person.
		expect(body).not.toContain('user:');
		expect(body).not.toContain('organization:');
		expect(body).toMatch(/userId: ID/);
		expect(body).toMatch(/organizationId: ID/);
	});

	it('declares no relation filter either, for the same reason', async () => {
		const { resolver } = surfaces();

		const error = await resolver
			.userOrganizations({ user: { email: { eq: 'ada@example.com' } } })
			.catch((thrown) => thrown);

		expect(isRefusal(error)).toBe(true);
		expect((error as Error).message).toContain('QUERY_UNKNOWN_FILTER_FIELD');
	});

	it('carries no audit-user stamp', () => {
		const body = typeBody('UserOrganization');

		for (const member of ['createdByUserId', 'updatedByUserId', 'deletedByUserId']) {
			expect(body).not.toContain(member);
		}
	});
});

describe('UserOrganizationResolver — the connection contract', () => {
	it('answers the list with nodes, edges, a total and the boundary cursors', async () => {
		const { resolver, userOrganizationService } = surfaces();

		const connection = await resolver.userOrganizations(undefined, undefined, undefined, 20);

		// The same read the list route performs, with the same relation list and the same false flag: the
		// employee the flag attaches is a member this surface's type does not carry.
		expect(userOrganizationService.findUserOrganizations).toHaveBeenCalledWith({}, false);
		expect(connection.nodes).toHaveLength(2);
		expect(connection.totalCount).toBe(2);
		expect(connection.pageInfo.startCursor).toBe(connection.edges[0].cursor);
		expect(connection.pageInfo.endCursor).toBe(connection.edges[1].cursor);
		expect(connection.pageInfo.hasNextPage).toBe(false);
		// The cursor is the platform's own codec, so the same cursor is valid on the REST surface.
		expect(CursorCodec.decode(connection.edges[0].cursor).id).toBe(MEMBERSHIP);
	});

	it('orders newest first when the caller states none', async () => {
		const { resolver } = surfaces();

		const connection = await resolver.userOrganizations();

		expect(connection.nodes.map((node) => node.id)).toEqual([MEMBERSHIP, OTHER_MEMBERSHIP]);
	});

	it('narrows by the fields the filter declares', async () => {
		const { resolver } = surfaces();

		const byOrganization = await resolver.userOrganizations({ organizationId: { eq: OTHER_ORGANIZATION } });
		expect(byOrganization.nodes.map((node) => node.id)).toEqual([OTHER_MEMBERSHIP]);

		const byDefault = await resolver.userOrganizations({ isDefault: { eq: true } });
		expect(byDefault.nodes.map((node) => node.id)).toEqual([MEMBERSHIP]);

		const byUser = await resolver.userOrganizations({ userId: { eq: USER } });
		expect(byUser.totalCount).toBe(2);
	});

	it('orders by the keys the sort enum offers', async () => {
		const { resolver } = surfaces();

		const byDefault = await resolver.userOrganizations(undefined, [{ field: 'isDefault', direction: 'DESC' }]);
		expect(byDefault.nodes.map((node) => node.id)).toEqual([MEMBERSHIP, OTHER_MEMBERSHIP]);

		const byOldest = await resolver.userOrganizations(undefined, [{ field: 'createdAt', direction: 'ASC' }]);
		expect(byOldest.nodes.map((node) => node.id)).toEqual([OTHER_MEMBERSHIP, MEMBERSHIP]);
	});

	it('resumes a walk from an opaque cursor, forwards and backwards', async () => {
		const { resolver } = surfaces();
		const first = await resolver.userOrganizations(undefined, undefined, undefined, 1);

		expect(first.nodes.map((node) => node.id)).toEqual([MEMBERSHIP]);

		const second = await resolver.userOrganizations(undefined, undefined, {
			first: 1,
			after: first.pageInfo.endCursor ?? undefined
		});

		expect(second.nodes.map((node) => node.id)).toEqual([OTHER_MEMBERSHIP]);
		expect(second.pageInfo.hasPreviousPage).toBe(true);

		const all = await resolver.userOrganizations(undefined, undefined, undefined, 20);
		const last = await resolver.userOrganizations(undefined, undefined, {
			last: 1,
			before: all.edges[1].cursor
		});

		expect(last.nodes.map((node) => node.id)).toEqual([MEMBERSHIP]);
		expect(last.pageInfo.hasNextPage).toBe(true);
	});

	it('refuses a sort field the resource does not declare, with the query protocol’s own code', async () => {
		const { resolver } = surfaces();

		const error = await resolver
			.userOrganizations(undefined, [{ field: 'userId', direction: 'ASC' }] as never)
			.catch((thrown) => thrown);

		expect(isRefusal(error)).toBe(true);
		expect((error as Error).message).toContain('QUERY_SORT_NOT_ALLOWED');
	});

	it('refuses both pagination styles at once rather than silently preferring one', async () => {
		const { resolver } = surfaces();

		const error = await resolver
			.userOrganizations(undefined, undefined, undefined, 5, undefined, undefined, undefined, 5)
			.catch((thrown) => thrown);

		expect(isRefusal(error)).toBe(true);
		expect((error as Error).message).toContain('QUERY_NESTING_LIMIT_EXCEEDED');
	});

	it('caps the page rather than answering every membership', async () => {
		const { resolver } = surfaces();

		const error = await resolver.userOrganizations(undefined, undefined, undefined, 500).catch((thrown) => thrown);

		expect(isRefusal(error)).toBe(true);
		expect((error as Error).message).toContain('QUERY_PAGE_LIMIT_EXCEEDED');
	});
});

describe('UserOrganizationResolver — one concept, two protocols, the same operations', () => {
	it('reads one membership through the same service method the REST route calls', async () => {
		const { resolver, userOrganizationService } = surfaces();

		expect(await resolver.userOrganization(MEMBERSHIP)).toBe(ROWS[0]);
		expect(userOrganizationService.findOneByIdString).toHaveBeenCalledWith(MEMBERSHIP);
	});

	it('answers null for a membership that is not there, which is the REST route’s 404 in this vocabulary', async () => {
		const { resolver, userOrganizationService } = surfaces();
		userOrganizationService.findOneByIdString.mockRejectedValueOnce(new NotFoundException());

		expect(await resolver.userOrganization(OTHER_MEMBERSHIP)).toBeNull();
	});

	it('counts through the same service method the count route calls, with the route’s own options', async () => {
		const { resolver, userOrganizationService } = surfaces();

		expect(await resolver.userOrganizationCount()).toBe(2);
		// The inherited route hands `countBy` the `where` fragment it bound from its query string and
		// asks for no narrowing of its own when the caller states none — which is the call this field
		// makes, because the connection protocol has no argument that fragment could arrive in.
		expect(userOrganizationService.countBy).toHaveBeenCalledWith();
	});

	it('answers the per-person count through the same two calls the route makes, in the same order', async () => {
		const { resolver, userOrganizationService } = surfaces();

		expect(await resolver.userOrganizationOrganizationsCount(MEMBERSHIP)).toBe(2);

		expect(userOrganizationService.findOneByIdString).toHaveBeenCalledWith(MEMBERSHIP);
		// The route counts the live, unarchived memberships of the account the row names — narrowed by
		// the identifier it read and by the two flags, which is the whole of what the route passes.
		expect(userOrganizationService.count).toHaveBeenCalledWith({
			where: { userId: USER, isActive: true, isArchived: false }
		});
	});

	it('surfaces a membership that is not there as the refusal the delivered route raises', async () => {
		const { resolver, userOrganizationService } = surfaces();
		const refusal = new Error('Failed to retrieve user organization count.');

		userOrganizationService.findOneByIdString.mockRejectedValueOnce(refusal);

		await expect(resolver.userOrganizationOrganizationsCount(OTHER_MEMBERSHIP)).rejects.toBe(refusal);
		// A missing row is never flattened into a count of nothing.
		expect(userOrganizationService.count).not.toHaveBeenCalled();
	});

	it('puts a person inside an organization through the same service method the REST route calls', async () => {
		const { resolver, userOrganizationService } = surfaces();

		await resolver.createUserOrganization({
			organizationId: ORGANIZATION,
			userId: USER,
			isDefault: true
		});

		// The tenant is the credential's and is stamped by the service, so a caller states which person
		// and which organization the membership joins and never which tenant it is written into.
		expect(userOrganizationService.create).toHaveBeenCalledWith({
			organizationId: ORGANIZATION,
			userId: USER,
			isDefault: true
		});
	});

	it('edits through the same service method the REST route calls, with the identifier as the criterion', async () => {
		const { resolver, userOrganizationService } = surfaces();

		await resolver.updateUserOrganization({ id: MEMBERSHIP, isDefault: false });

		// The identifier is the criterion and is not repeated in the payload, which is the shape the
		// route itself has, and a member the caller leaves out is left as it is.
		expect(userOrganizationService.update).toHaveBeenCalledWith(MEMBERSHIP, { isDefault: false });
		// The row the write produced is read back, because the delivered route answers the store's own
		// update result rather than a row.
		expect(userOrganizationService.findOneByIdString).toHaveBeenCalledWith(MEMBERSHIP);
	});

	it('relies on the delivered write before the read back, so a missing membership is a miss rather than a write', async () => {
		const { resolver, userOrganizationService } = surfaces();
		userOrganizationService.update.mockRejectedValueOnce(new NotFoundException());

		await expect(resolver.updateUserOrganization({ id: OTHER_MEMBERSHIP, isDefault: true })).rejects.toBeInstanceOf(
			NotFoundException
		);
		expect(userOrganizationService.findOneByIdString).not.toHaveBeenCalled();
	});

	it('removes a person from an organization through the command the REST route dispatches', async () => {
		const { resolver, commandBus } = surfaces();

		expect(await resolver.deleteUserOrganization(MEMBERSHIP)).toBe(true);

		const command = commandBus.execute.mock.calls[0][0];
		expect(command).toBeInstanceOf(UserOrganizationDeleteCommand);
		expect(command.userOrganizationId).toBe(MEMBERSHIP);
	});

	it('withdraws and restores a membership through the same two service methods', async () => {
		const { resolver, userOrganizationService } = surfaces();

		const withdrawn = await resolver.softDeleteUserOrganization(MEMBERSHIP);
		expect(userOrganizationService.softRemove).toHaveBeenCalledWith(MEMBERSHIP);
		expect(withdrawn.deletedAt).toBeInstanceOf(Date);

		const restored = await resolver.recoverUserOrganization(MEMBERSHIP);
		expect(userOrganizationService.softRecover).toHaveBeenCalledWith(MEMBERSHIP);
		expect(restored.deletedAt).toBeNull();
	});

	it('surfaces a refusal as a 4xx that is not a 404', async () => {
		const { resolver, commandBus } = surfaces();
		const refusal = new Error('Only Super Admin users can delete Super Admin users');

		commandBus.execute.mockRejectedValueOnce(refusal);

		await expect(resolver.deleteUserOrganization(MEMBERSHIP)).rejects.toBe(refusal);
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
	{ field: 'userOrganizations', route: 'findAll' },
	{ field: 'userOrganization', route: 'findById' },
	{ field: 'userOrganizationCount', route: 'getCount' },
	{ field: 'userOrganizationOrganizationsCount', route: 'findOrganizationCount' },
	{ field: 'createUserOrganization', route: 'create' },
	{ field: 'updateUserOrganization', route: 'update' },
	{ field: 'deleteUserOrganization', route: 'delete' },
	{ field: 'softDeleteUserOrganization', route: 'softRemove' },
	{ field: 'recoverUserOrganization', route: 'softRecover' }
];

describe('UserOrganizationResolver — the guard stack is the controller’s, field by field', () => {
	it('guards the resolver with the controller’s class chain, plus the gate the endpoint adds', () => {
		const controllerGuards = Reflect.getMetadata('__guards__', UserOrganizationController) ?? [];
		const resolverGuards = Reflect.getMetadata('__guards__', UserOrganizationResolver) ?? [];

		// The scope guard is the part both surfaces carry; the gate is this surface's own, because a
		// capability is asked of the endpoint rather than of the resource behind it. The controller carries
		// the permission guard at class level and states the permission per route, so the resolver's chain
		// has to contain the controller's — otherwise the five administrative routes below are reachable
		// here by a caller those routes refuse.
		expect(controllerGuards).toEqual(expect.arrayContaining([TenantPermissionGuard, PermissionGuard]));
		expect(resolverGuards).toEqual(expect.arrayContaining([TenantPermissionGuard]));
		expect(resolverGuards).toEqual(expect.arrayContaining(controllerGuards));

		// Neither surface states a permission at class level: one there would gate the reads as well, and
		// the reads are served to any member of the tenant on both protocols.
		expect(Reflect.getMetadata(PERMISSIONS_METADATA, UserOrganizationController)).toBeUndefined();
		expect(Reflect.getMetadata(PERMISSIONS_METADATA, UserOrganizationResolver)).toBeUndefined();
	});

	it('runs every route under the class chain, each stating its own permission and no guard of its own', () => {
		const declared = (Reflect.getMetadata('__guards__', UserOrganizationController) ?? []) as unknown[];

		for (const { route } of ROUTE_PARITY) {
			// No route adds a guard of its own and none pushes its permission up to the class, so the split
			// is the same on both surfaces — which is what lets the comparison below read the route's own
			// metadata instead of a table of permission names written out in this file.
			expect(Reflect.getMetadata('__guards__', handlersOf(UserOrganizationController)[route])).toBeUndefined();
			expect(guardsOfRoute(UserOrganizationController, route)).toEqual(declared);
		}
	});

	it.each(ROUTE_PARITY)('$field mirrors $route exactly', ({ field, route }) => {
		// A route that is not served at all would make the comparison meaningless, so the handler is
		// asserted to be there before the two readings are compared — inherited handlers included.
		expect(typeof handlersOf(UserOrganizationController)[route]).toBe('function');

		// The one addition is the gate on the endpoint itself, which the route does not carry because it
		// is not a scope: every other guard of the field's chain still has to be the route's own.
		expect(guardsOfField(field).sort()).toEqual(
			[...guardsOfRoute(UserOrganizationController, route), FeatureFlagGuard].sort()
		);
		expect(permissionOfField(field)).toEqual(permissionOfRoute(UserOrganizationController, route));
	});

	it('states on every field exactly what its own route states, read from the route', () => {
		// Read from both surfaces rather than restated here: a table of permission names would agree with
		// the resolver while disagreeing with the controller, which is the failure this half of the
		// doctrine exists to catch. Five of these routes demand `ORG_USERS_EDIT`, so their fields must too
		// — a field that mirrored an ungated route would be the whole of this assertion's point.
		expect(ROUTE_PARITY.some(({ route }) => permissionOfRoute(UserOrganizationController, route))).toBe(true);

		for (const { field, route } of ROUTE_PARITY) {
			expect(Reflect.getMetadata(PERMISSIONS_METADATA, fieldsOf(UserOrganizationResolver)[field])).toEqual(
				Reflect.getMetadata(PERMISSIONS_METADATA, handlersOf(UserOrganizationController)[route])
			);
			expect(permissionOfField(field)).toEqual(permissionOfRoute(UserOrganizationController, route));
		}
	});
});

describe('UserOrganizationModule — the resolver is declared where its dependencies are reachable', () => {
	it('declares the resolver as a provider of the module that owns the service', () => {
		const providers = (Reflect.getMetadata(MODULE_METADATA.PROVIDERS, UserOrganizationModule) ?? []) as unknown[];

		expect(providers).toContain(UserOrganizationResolver);
		expect(providers).toContain(UserOrganizationService);
	});

	it('exports the service the resolver injects, and the bus its dispatch resolves through', () => {
		// A resolver is a provider of whichever module the Apollo configuration names, so a module that
		// imports this one receives what this one hands on and nothing else.
		const exported = (Reflect.getMetadata(MODULE_METADATA.EXPORTS, UserOrganizationModule) ?? []) as unknown[];

		expect(exported).toContain(UserOrganizationService);
		expect(exported.map((entry) => (entry as { name?: string })?.name)).toContain('CqrsModule');
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
		getHandler: () => (UserOrganizationResolver.prototype as never)[field],
		getClass: () => UserOrganizationResolver,
		getType: () => 'graphql',
		getArgByIndex: () => ({ fieldName: field })
	} as unknown as ExecutionContext;
}

describe('UserOrganizationResolver — a capability that is switched off is not served', () => {
	it('declares the capability the commerce catalogue declares for this surface, on the class', () => {
		// One statement, read by the guard with `getAllAndOverride` over the handler and then the class,
		// so every field is behind it.
		expect(Reflect.getMetadata(FEATURE_METADATA, UserOrganizationResolver)).toBe(FEATURE_GRAPHQL);
		expect(Reflect.getMetadata('__guards__', UserOrganizationResolver)).toContain(FeatureFlagGuard);
	});

	it('refuses a field whose capability is switched off, and names the field it refused', async () => {
		const { guard, featureService } = gate(false);

		const refusal = await guard.canActivate(graphqlContext('userOrganizations')).catch((thrown) => thrown);

		// The code the guard resolved is the one this resolver declared, not a second copy of it.
		expect(featureService.isFeatureEnabled).toHaveBeenCalledWith(FEATURE_GRAPHQL);
		expect(refusal).toBeInstanceOf(NotFoundException);
		// A disabled capability answers the way a missing one does, and says which field was refused.
		expect((refusal as Error).message).toContain('userOrganizations');
		expect((refusal as NotFoundException).getStatus()).toBe(404);
	});

	it('serves the field once the capability is switched on', async () => {
		const { guard } = gate(true);

		await expect(guard.canActivate(graphqlContext('userOrganizations'))).resolves.toBe(true);
	});
});
