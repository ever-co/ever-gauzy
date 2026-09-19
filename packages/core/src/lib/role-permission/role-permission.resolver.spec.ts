/**
 * 🛑 This import must stay FIRST, before any import that pulls a core service or controller — see
 * `channel.controller.spec.ts` for the cycle it avoids: an entity decorator is undefined when the
 * entity applies it if the graph is entered through the validators rather than through the entities.
 */
import '../core/entities/internal';

import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { ExecutionContext, NotFoundException } from '@nestjs/common';
import { METHOD_METADATA, MODULE_METADATA } from '@nestjs/common/constants';
import { Reflector } from '@nestjs/core';
import { Kind, buildSchema, parse, printSchema } from 'graphql';
import { PermissionsEnum } from '@gauzy/contracts';
import { FEATURE_METADATA, PERMISSIONS_METADATA } from '@gauzy/constants';
import { CursorCodec } from '../api/cursor';
import { FeatureFlagGuard, PermissionGuard, TenantPermissionGuard } from '../shared/guards';
import { RolePermissionController } from './role-permission.controller';
import { RolePermissionModule } from './role-permission.module';
import { RolePermissionResolver } from './role-permission.resolver';
import { RolePermissionService } from './role-permission.service';

/**
 * The permissions a role carries, over GraphQL.
 *
 * The delivered `/api/role-permissions` routes serve a list, one row, the caller's own permissions, a
 * count, a filing, an edit, a removal and the two lifecycle moves. This suite pins the half of the
 * two-protocol doctrine that is easy to get quietly wrong:
 *
 * - every one of those capabilities is a root field of the one composed schema, and the list is a
 *   connection with the platform's own cursor codec behind it, so a cursor obtained over REST resumes
 *   here and a refusal is the query protocol's own code;
 * - every field reaches the same service method the REST route reaches, so a client does not choose a
 *   better surface by choosing a protocol — including the list, whose scope (the tenant for a super
 *   administrator, every role but the super administrator's own for a holder of
 *   `CHANGE_ROLES_PERMISSIONS`, and the acting role's own rows for anybody else) is the service's and
 *   is deliberately not restated anywhere in the resolver;
 * - **the guard chain is the controller's and every field states the permission its own route runs
 *   under** — read from the controller's own metadata rather than restated in this file. The reading
 *   of the caller's own permissions is the field where that matters most: its route states an *empty*
 *   permission set, which is what makes it the one read of this resource every authenticated caller is
 *   served, and a field that demanded the administrative permission instead would refuse them;
 * - the migration route is the one delivered route with no field, and that is asserted rather than
 *   left to be discovered: what it answers is the export-import ledger's rows, a concept this domain
 *   does not own;
 * - the gate on the endpoint itself is carried on the class, the way the routes carry the guards.
 */

const TENANT = '00000000-0000-4000-8000-000000000001';
const ADMIN = '00000000-0000-4000-8000-000000000010';
const VIEWER = '00000000-0000-4000-8000-000000000012';
const ADMIN_VIEW = '00000000-0000-4000-8000-000000000020';
const ADMIN_EDIT = '00000000-0000-4000-8000-000000000021';
const VIEWER_VIEW = '00000000-0000-4000-8000-000000000022';

/**
 * The rows a scripted service answers with, in the order the delivered list read returns them: the
 * order the store holds them in, which is the order the connection has to impose one on. Two rows
 * carry the same permission, which is what makes the identifier the tie-break a walk depends on.
 */
const ROWS = [
	{
		id: ADMIN_VIEW,
		tenantId: TENANT,
		roleId: ADMIN,
		permission: 'ALL_ORG_VIEW',
		enabled: true,
		description: null,
		createdAt: new Date('2026-01-01T10:00:00.000Z'),
		updatedAt: new Date('2026-01-01T10:00:00.000Z')
	},
	{
		id: ADMIN_EDIT,
		tenantId: TENANT,
		roleId: ADMIN,
		permission: 'ALL_ORG_EDIT',
		enabled: false,
		description: null,
		createdAt: new Date('2026-01-02T10:00:00.000Z'),
		updatedAt: new Date('2026-01-02T10:00:00.000Z')
	},
	{
		id: VIEWER_VIEW,
		tenantId: TENANT,
		roleId: VIEWER,
		permission: 'ALL_ORG_VIEW',
		enabled: true,
		description: null,
		createdAt: new Date('2026-01-03T10:00:00.000Z'),
		updatedAt: new Date('2026-01-03T10:00:00.000Z')
	}
];

/** The resolver, over a scripted service. */
function surfaces() {
	const rolePermissionService = {
		findAllRolePermissions: jest.fn().mockResolvedValue({ items: ROWS, total: ROWS.length }),
		findOneByIdString: jest.fn().mockResolvedValue(ROWS[0]),
		findMePermissions: jest.fn().mockResolvedValue([ROWS[0], ROWS[2]]),
		countBy: jest.fn().mockResolvedValue(ROWS.length),
		createPermission: jest.fn().mockResolvedValue(ROWS[0]),
		updatePermission: jest.fn().mockResolvedValue({ affected: 1 }),
		deletePermission: jest.fn().mockResolvedValue({ affected: 1 }),
		softRemove: jest.fn().mockResolvedValue({ ...ROWS[0], deletedAt: new Date('2026-04-01T10:00:00.000Z') }),
		softRecover: jest.fn().mockResolvedValue(ROWS[0])
	};

	return {
		rolePermissionService,
		resolver: new RolePermissionResolver(rolePermissionService as never)
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
 * The schema this domain's documents compose into: the kernel's own documents beside this domain's,
 * which is the whole of what they need to resolve.
 *
 * The platform-wide schema is deliberately not built here. What these documents reference beyond their
 * own types is the kernel — the scalars, `PageInfo`, `PageInput`, the filter family and
 * `SortDirection` — so a suite that reached for every domain's document would fail whenever another
 * domain's SDL is mid-flight, and would be reporting somebody else's state rather than this surface's.
 * The composition of the whole platform, collisions and all, is asserted by
 * `tools/scripts/check-graphql-composition.js`, which is the check that owns that question.
 */
function domainSchema(): string {
	const walk = (directory: string): string[] =>
		readdirSync(directory, { withFileTypes: true })
			.filter((entry) => entry.isFile() && entry.name.endsWith('.gql'))
			.map((entry) => readFileSync(join(directory, entry.name), 'utf8'));

	return [...walk(join(__dirname, '..', 'graphql', 'schema')), ...walk(join(__dirname, 'schema'))].join('\n');
}

/** The schema, built once: the composition itself is asserted by the composition check, not here. */
const schema = buildSchema(domainSchema());

/** The schema as text, printed once. */
const printed = printSchema(schema);

/** The fields one root operation type declares, as a client reads them. */
function rootFields(operation: 'Query' | 'Mutation'): string[] {
	const root = schema.getType(operation) as { getFields(): Record<string, unknown> } | undefined;

	return Object.keys(root?.getFields() ?? {});
}

/** The arguments one root field declares, in the order a client states them. */
function fieldArgs(operation: 'Query' | 'Mutation', field: string): string[] {
	const root = schema.getType(operation) as
		| { getFields(): Record<string, { args: readonly { name: string }[] }> }
		| undefined;

	return (root?.getFields()?.[field]?.args ?? []).map((argument) => argument.name);
}

/**
 * The root fields one document of this domain contributes, read from the document itself, so the set
 * can be asserted exactly — including the fields that are deliberately absent.
 */
function contributedRootFields(document: string): { query: string[]; mutation: string[] } {
	const parsed = parse(readFileSync(join(__dirname, 'schema', document), 'utf8'));
	const query: string[] = [];
	const mutation: string[] = [];

	for (const definition of parsed.definitions) {
		if (definition.kind !== Kind.OBJECT_TYPE_EXTENSION) {
			continue;
		}

		for (const field of definition.fields ?? []) {
			if (definition.name.value === 'Query') query.push(field.name.value);
			if (definition.name.value === 'Mutation') mutation.push(field.name.value);
		}
	}

	return { query: query.sort(), mutation: mutation.sort() };
}

/** The printed body of one object type, so a member it must not carry can be asserted absent. */
function typeBody(name: string): string {
	return printed.match(new RegExp(`type ${name} \\{([\\s\\S]*?)\\n\\}`))?.[1] ?? '';
}

/** The handlers of one controller, as functions, inherited ones included. */
function handlersOf(controller: typeof RolePermissionController): Record<string, object> {
	return controller.prototype as unknown as Record<string, object>;
}

/**
 * Every route the controller serves, inherited ones included.
 *
 * A route is a handler that carries the request method metadata its decorator sets; the CRUD base's
 * routes are on the parent prototype, so the chain is walked rather than the class read alone. The
 * check is against `undefined` rather than truthiness: `RequestMethod.GET` is `0`, so a truthiness
 * test would quietly leave every read of the resource out of the set.
 */
function routesOf(controller: typeof RolePermissionController): string[] {
	const routes = new Set<string>();
	let prototype = controller.prototype;

	while (prototype && prototype !== Object.prototype) {
		for (const name of Object.getOwnPropertyNames(prototype)) {
			if (name === 'constructor') continue;
			if (Reflect.getMetadata(METHOD_METADATA, prototype[name]) === undefined) continue;
			routes.add(name);
		}

		prototype = Object.getPrototypeOf(prototype);
	}

	return [...routes].sort();
}

/**
 * The permission one route runs under: what its handler states, else what its controller states.
 *
 * This is the rule the guards themselves apply — the reflector's `getAllAndOverride` over
 * `[handler, class]` — restated here, so the resolver is held to the controller's own metadata rather
 * than to a second copy of the same list written out in this file.
 */
function permissionOfRoute(controller: typeof RolePermissionController, handler: string): unknown {
	return (
		Reflect.getMetadata(PERMISSIONS_METADATA, handlersOf(controller)[handler]) ??
		Reflect.getMetadata(PERMISSIONS_METADATA, controller)
	);
}

/**
 * The guards one route actually runs under: the controller's chain followed by whatever the handler
 * states of its own, which is the order the guard context creator concatenates them in.
 */
function guardsOfRoute(controller: typeof RolePermissionController, handler: string): unknown[] {
	const declared = Reflect.getMetadata('__guards__', controller) ?? [];
	const restated = Reflect.getMetadata('__guards__', handlersOf(controller)[handler]) ?? [];

	return Array.from(new Set([...declared, ...restated]));
}

/** The permission one resolver field runs under. */
function permissionOfField(field: string): unknown {
	const fields = RolePermissionResolver.prototype as unknown as Record<string, object>;

	return Reflect.getMetadata(PERMISSIONS_METADATA, fields[field]);
}

/**
 * Every root field and the delivered route it mirrors.
 *
 * The two surfaces are one capability stated twice, so the guard stack and the permission of a field
 * are read from the field and from the route's own metadata and compared, rather than restated here.
 * A field appears once per route it mirrors, and the list appears three times because the controller
 * serves it three times — its own `findAllRolePermissions` at `GET /`, the CRUD base's `findAll` at
 * the same path, and the base's `pagination` — and the mandate is that the connection *is* that list:
 * the paginated spelling is the connection's own page rather than a capability of its own.
 */
const ROUTE_PARITY: ReadonlyArray<{ field: string; route: string }> = [
	{ field: 'rolePermissions', route: 'findAllRolePermissions' },
	{ field: 'rolePermissions', route: 'findAll' },
	{ field: 'rolePermissions', route: 'pagination' },
	{ field: 'rolePermission', route: 'findById' },
	{ field: 'myRolePermissions', route: 'findMePermissions' },
	{ field: 'rolePermissionCount', route: 'getCount' },
	{ field: 'createRolePermission', route: 'create' },
	{ field: 'updateRolePermission', route: 'update' },
	{ field: 'deleteRolePermission', route: 'delete' },
	{ field: 'softDeleteRolePermission', route: 'softRemove' },
	{ field: 'recoverRolePermission', route: 'softRecover' }
];

describe('RolePermissionResolver — the SDL declares the capabilities the REST routes serve', () => {
	it('declares the connection, the node, the caller’s own read and the count', () => {
		expect(contributedRootFields('role-permission.api.gql').query).toEqual([
			'myRolePermissions',
			'rolePermission',
			'rolePermissionCount',
			'rolePermissions'
		]);
	});

	it('declares one mutation per delivered write route', () => {
		expect(contributedRootFields('role-permission.api.gql').mutation).toEqual([
			'createRolePermission',
			'deleteRolePermission',
			'recoverRolePermission',
			'softDeleteRolePermission',
			'updateRolePermission'
		]);
	});

	it('reaches every one of those fields from a root operation type of the built schema', () => {
		expect(rootFields('Query')).toEqual(
			expect.arrayContaining([
				'rolePermissions',
				'rolePermission',
				'myRolePermissions',
				'rolePermissionCount'
			])
		);
		expect(rootFields('Mutation')).toEqual(
			expect.arrayContaining([
				'createRolePermission',
				'updateRolePermission',
				'deleteRolePermission',
				'softDeleteRolePermission',
				'recoverRolePermission'
			])
		);
	});

	it('mirrors every delivered route, with the paginated list folded into the connection', () => {
		const mirrored = new Set(ROUTE_PARITY.map(({ route }) => route));
		const unmirrored = routesOf(RolePermissionController).filter((route) => !mirrored.has(route));

		// Every route the controller serves, its own and the CRUD base's alike, read from the classes
		// rather than written out here. `findAll` is the base's list handler: its path is the one this
		// controller serves with `findAllRolePermissions`, and the two run under the same permission.
		expect(routesOf(RolePermissionController)).toEqual([
			'create',
			'delete',
			'findAll',
			'findAllRolePermissions',
			'findById',
			'findMePermissions',
			'getCount',
			'importRole',
			'pagination',
			'softRecover',
			'softRemove',
			'update'
		]);
		// `pagination` is the list route's second spelling and is what the connection's own page states,
		// so it is not a field of its own. `importRole` is the migration route, whose answer is the
		// export-import ledger's rows rather than anything this domain owns — the one delivered route
		// this surface leaves, and the one it leaves on purpose.
		expect(unmirrored).toEqual(['importRole']);
	});

	it('declares the connection, its edges, its filters and its sorts', () => {
		expect(printed).toMatch(
			/type RolePermissionConnection \{\s*nodes: \[RolePermission!\]!\s*edges: \[RolePermissionEdge!\]!\s*totalCount: Int!\s*pageInfo: PageInfo!\s*\}/
		);
		expect(printed).toMatch(/type RolePermissionEdge \{\s*node: RolePermission!\s*cursor: String!\s*\}/);
		expect(printed).toMatch(/input RolePermissionFilter \{/);
		expect(printed).toMatch(/input RolePermissionSort \{/);
		expect(printed).toMatch(/enum RolePermissionSortField \{\s*createdAt\s*updatedAt\s*permission\s*enabled\s*\}/);
	});

	it('declares the write inputs the mutations take', () => {
		expect(printed).toMatch(/input CreateRolePermissionInput \{/);
		expect(printed).toMatch(/input UpdateRolePermissionInput \{/);
	});

	it('carries the row’s own facts, the lifecycle marker, and not the relation no read loads', () => {
		const body = typeBody('RolePermission');

		expect(body).toMatch(/permission: String!/);
		expect(body).toMatch(/enabled: Boolean!/);
		expect(body).toMatch(/roleId: ID!/);
		// Withdrawing and restoring are delivered routes whose whole effect is this column, so it is
		// carried: without it the answer to the write that withdrew a row would not say so.
		expect(body).toMatch(/deletedAt: DateTime/);
		// The role is loaded only when a REST caller names the relation, which none of the reads here
		// does, so a member would be null on every row this surface answers — the identifier is what
		// travels with the row.
		expect(body).not.toMatch(/^\s*role: Role$/m);
	});

	it('carries the permission as its value rather than as an enum this domain would have to own', () => {
		// The vocabulary is the platform's permission catalogue, which lives in the contracts package
		// and grows with every capability; an enum declared here would be a second copy of it and would
		// have to be edited in step with the catalogue for a caller to name a new permission at all.
		expect(printed).not.toMatch(/^enum Permission\b/m);
		expect(typeBody('RolePermission')).toMatch(/permission: String!/);
		expect(printed).toMatch(/input CreateRolePermissionInput \{[\s\S]*?permission: String!/);
	});

	it('offers no argument it cannot honour', () => {
		expect(fieldArgs('Query', 'rolePermissions')).toEqual([
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
		// The count route passes its query string through as the store's own `where`, which this
		// surface cannot hand to that call, so the count states no narrowing it could not honour.
		expect(fieldArgs('Query', 'rolePermissionCount')).toEqual([]);
		// The caller's own permissions are not a page and take no narrowing: the route serves the rows
		// of the role the credential is acting in and nothing else.
		expect(fieldArgs('Query', 'myRolePermissions')).toEqual([]);
	});
});

describe('RolePermissionResolver — the connection contract', () => {
	it('answers the list with nodes, edges, a total and the boundary cursors', async () => {
		const { resolver, rolePermissionService } = surfaces();

		const connection = await resolver.rolePermissions(undefined, undefined, undefined, 20);

		// The read is the one the REST list route performs, handed the empty query object the route's
		// own DTO arrives as: the reader builds its tenant and role fragment from it, which is the
		// scope the two surfaces share.
		expect(rolePermissionService.findAllRolePermissions).toHaveBeenCalledWith({});
		expect(connection.nodes).toHaveLength(3);
		expect(connection.totalCount).toBe(3);
		expect(connection.pageInfo.startCursor).toBe(connection.edges[0].cursor);
		expect(connection.pageInfo.endCursor).toBe(connection.edges[2].cursor);
		expect(connection.pageInfo.hasNextPage).toBe(false);
		// The cursor is the platform's own codec, so the same cursor is valid on the REST surface.
		expect(CursorCodec.decode(connection.edges[0].cursor).id).toBe(ADMIN_EDIT);
	});

	it('orders by the catalogue’s own order when the caller states none', async () => {
		const { resolver } = surfaces();

		const connection = await resolver.rolePermissions();

		// Two rows carry the same permission, so the identifier is what decides between them — which is
		// what makes the order total and a cursor walk over it stable.
		expect(connection.nodes.map((node) => node.id)).toEqual([ADMIN_EDIT, ADMIN_VIEW, VIEWER_VIEW]);
	});

	it('narrows by the fields the filter declares, including the role the rows belong to', async () => {
		const { resolver } = surfaces();

		const byRole = await resolver.rolePermissions({ roleId: { eq: ADMIN } });
		expect(byRole.nodes.map((node) => node.id)).toEqual([ADMIN_EDIT, ADMIN_VIEW]);

		const byState = await resolver.rolePermissions({ enabled: { eq: false } });
		expect(byState.nodes.map((node) => node.id)).toEqual([ADMIN_EDIT]);

		const byPermission = await resolver.rolePermissions({ permission: { eq: 'ALL_ORG_VIEW' } });
		expect(byPermission.nodes.map((node) => node.id)).toEqual([ADMIN_VIEW, VIEWER_VIEW]);

		const byBoth = await resolver.rolePermissions({ and: [{ roleId: { eq: VIEWER } }, { enabled: { eq: true } }] });
		expect(byBoth.nodes.map((node) => node.id)).toEqual([VIEWER_VIEW]);
	});

	it('orders by the keys the sort enum offers', async () => {
		const { resolver } = surfaces();

		const byCreation = await resolver.rolePermissions(undefined, [{ field: 'createdAt', direction: 'DESC' }]);
		expect(byCreation.nodes.map((node) => node.id)).toEqual([VIEWER_VIEW, ADMIN_EDIT, ADMIN_VIEW]);

		const byPermission = await resolver.rolePermissions(undefined, [{ field: 'permission', direction: 'DESC' }]);
		expect(byPermission.nodes.map((node) => node.permission)).toEqual([
			'ALL_ORG_VIEW',
			'ALL_ORG_VIEW',
			'ALL_ORG_EDIT'
		]);

		const byEnabled = await resolver.rolePermissions(undefined, [{ field: 'enabled', direction: 'ASC' }]);
		expect(byEnabled.nodes[0].enabled).toBe(false);
	});

	it('resumes a walk from an opaque cursor, over rows that share the first sort key', async () => {
		const { resolver } = surfaces();
		const first = await resolver.rolePermissions(undefined, undefined, undefined, 2);

		expect(first.nodes.map((node) => node.id)).toEqual([ADMIN_EDIT, ADMIN_VIEW]);

		const second = await resolver.rolePermissions(undefined, undefined, {
			first: 1,
			after: first.pageInfo.endCursor ?? undefined
		});

		// The row that shares the permission with the one the cursor names is the row that follows it,
		// which is what the identifier tie-break buys.
		expect(second.nodes.map((node) => node.id)).toEqual([VIEWER_VIEW]);
		expect(second.pageInfo.hasPreviousPage).toBe(true);
	});

	it('walks backwards from a cursor as well as forwards', async () => {
		const { resolver } = surfaces();
		const all = await resolver.rolePermissions(undefined, undefined, undefined, 20);

		const last = await resolver.rolePermissions(undefined, undefined, {
			last: 1,
			before: all.edges[2].cursor
		});

		expect(last.nodes.map((node) => node.id)).toEqual([ADMIN_VIEW]);
		expect(last.pageInfo.hasNextPage).toBe(true);
	});

	it('refuses a cursor this server did not mint, with the query protocol’s own code', async () => {
		const { resolver } = surfaces();
		// A well-formed base64url string that carries no sort value and no identifier: the walk cannot
		// resume from it, and the refusal is the protocol's rather than a decoder's message.
		const notACursor = Buffer.from('not-a-cursor').toString('base64url');

		const error = await resolver
			.rolePermissions(undefined, undefined, { first: 1, after: notACursor })
			.catch((thrown) => thrown);

		expect(isRefusal(error)).toBe(true);
		expect((error as Error).message).toContain('QUERY_CURSOR_INVALID');
	});

	it('refuses a cursor minted under another order rather than resuming at the wrong row', async () => {
		const { resolver } = surfaces();
		const foreign = CursorCodec.encode(ROWS[0].createdAt, ADMIN_VIEW, [{ field: 'createdAt', direction: 'DESC' }]);

		const error = await resolver
			.rolePermissions(undefined, undefined, { first: 1, after: foreign })
			.catch((thrown) => thrown);

		expect(isRefusal(error)).toBe(true);
		expect((error as Error).message).toContain('QUERY_CURSOR_SORT_MISMATCH');
	});

	it('refuses a sort field the resource does not declare, with the query protocol’s own code', async () => {
		const { resolver } = surfaces();

		const error = await resolver
			.rolePermissions(undefined, [{ field: 'roleId', direction: 'ASC' }] as never)
			.catch((thrown) => thrown);

		expect(isRefusal(error)).toBe(true);
		expect((error as Error).message).toContain('QUERY_SORT_NOT_ALLOWED');
	});

	it('refuses a filter field the resource does not declare', async () => {
		const { resolver } = surfaces();

		// The relation the type deliberately does not carry cannot be filtered on either, and the
		// refusal is the query protocol's own rather than a silent narrowing to nothing.
		const error = await resolver.rolePermissions({ role: { eq: ADMIN } }).catch((thrown) => thrown);

		expect(isRefusal(error)).toBe(true);
		expect((error as Error).message).toContain('QUERY_UNKNOWN_FILTER_FIELD');
	});

	it('refuses both pagination styles at once rather than silently preferring one', async () => {
		const { resolver } = surfaces();

		const error = await resolver
			.rolePermissions(undefined, undefined, undefined, 5, undefined, undefined, undefined, 5)
			.catch((thrown) => thrown);

		expect(isRefusal(error)).toBe(true);
		expect((error as Error).message).toContain('QUERY_NESTING_LIMIT_EXCEEDED');
	});
});

describe('RolePermissionResolver — one concept, two protocols, the same operations', () => {
	it('reads one row through the same service method the REST node route calls', async () => {
		const { resolver, rolePermissionService } = surfaces();

		expect(await resolver.rolePermission(ADMIN_VIEW)).toBe(ROWS[0]);
		expect(rolePermissionService.findOneByIdString).toHaveBeenCalledWith(ADMIN_VIEW);
	});

	it('answers null for a row that is not there, which is the REST route’s 404 in this vocabulary', async () => {
		const { resolver, rolePermissionService } = surfaces();
		rolePermissionService.findOneByIdString.mockRejectedValueOnce(new NotFoundException());

		expect(await resolver.rolePermission(VIEWER_VIEW)).toBeNull();
	});

	it('reads the caller’s own permissions through the same service method the route calls', async () => {
		const { resolver, rolePermissionService } = surfaces();

		expect(await resolver.myRolePermissions()).toEqual([ROWS[0], ROWS[2]]);
		expect(rolePermissionService.findMePermissions).toHaveBeenCalledWith();
	});

	it('counts through the same service method the count route calls, with the route’s own options', async () => {
		const { resolver, rolePermissionService } = surfaces();

		expect(await resolver.rolePermissionCount()).toBe(3);
		expect(rolePermissionService.countBy).toHaveBeenCalledWith();
	});

	it('creates through the same service method the REST route calls, with the members it resolves', async () => {
		const { resolver, rolePermissionService } = surfaces();

		await resolver.createRolePermission({ permission: 'ALL_ORG_VIEW', enabled: true, roleId: ADMIN });

		expect(rolePermissionService.createPermission).toHaveBeenCalledWith({
			permission: 'ALL_ORG_VIEW',
			enabled: true,
			roleId: ADMIN
		});
	});

	it('edits through the same service method the REST route calls, and reads the row back', async () => {
		const { resolver, rolePermissionService } = surfaces();

		expect(
			await resolver.updateRolePermission({
				id: ADMIN_EDIT,
				permission: 'ALL_ORG_EDIT',
				enabled: true,
				roleId: ADMIN
			})
		).toBe(ROWS[0]);

		// The identifier names the row and the remaining members are the body, which is the shape the
		// delivered route has: `:id` in the path, the same body the create takes.
		expect(rolePermissionService.updatePermission).toHaveBeenCalledWith(ADMIN_EDIT, {
			permission: 'ALL_ORG_EDIT',
			enabled: true,
			roleId: ADMIN
		});
		// The delivered result is the store's own statement about the write rather than a row, so the
		// record is read back through the same service.
		expect(rolePermissionService.findOneByIdString).toHaveBeenLastCalledWith(ADMIN_EDIT);
	});

	it('removes a row through the same service method the REST route calls', async () => {
		const { resolver, rolePermissionService } = surfaces();

		expect(await resolver.deleteRolePermission(ADMIN_EDIT)).toBe(true);
		expect(rolePermissionService.deletePermission).toHaveBeenCalledWith(ADMIN_EDIT);
	});

	it('withdraws and restores a row through the same service methods the inherited routes call', async () => {
		const { resolver, rolePermissionService } = surfaces();

		const withdrawn = await resolver.softDeleteRolePermission(ADMIN_VIEW);
		expect(withdrawn.deletedAt).toBeInstanceOf(Date);
		expect(rolePermissionService.softRemove).toHaveBeenCalledWith(ADMIN_VIEW);

		expect(await resolver.recoverRolePermission(ADMIN_VIEW)).toBe(ROWS[0]);
		expect(rolePermissionService.softRecover).toHaveBeenCalledWith(ADMIN_VIEW);
	});

	it('surfaces a refusal as a 4xx that is not a 404', async () => {
		const { resolver, rolePermissionService } = surfaces();
		const refusal = new Error('CANNOT_GRANT_TO_SUPER_ADMIN: this role administers the tenant.');

		rolePermissionService.createPermission.mockRejectedValueOnce(refusal);

		await expect(
			resolver.createRolePermission({ permission: 'ALL_ORG_VIEW', enabled: true, roleId: ADMIN })
		).rejects.toBe(refusal);
	});
});

describe('RolePermissionResolver — the guard stack and the permission are the controller’s', () => {
	it('guards the resolver the way the controller is guarded, and appends the gate to that chain', () => {
		const resolverGuards = Reflect.getMetadata('__guards__', RolePermissionResolver) ?? [];
		const controllerGuards = Reflect.getMetadata('__guards__', RolePermissionController) ?? [];

		expect(controllerGuards).toEqual([TenantPermissionGuard, PermissionGuard]);
		// One statement: the routes' own chain, with the gate on the endpoint appended rather than
		// replacing any part of it.
		expect(resolverGuards).toEqual([TenantPermissionGuard, PermissionGuard, FeatureFlagGuard]);
	});

	it('runs every route under the guard chain the resolver states', () => {
		const stated = Reflect.getMetadata('__guards__', RolePermissionResolver) ?? [];

		for (const handler of routesOf(RolePermissionController)) {
			// The controller's chain plus the gate on the endpoint itself is the same set as the
			// resolver's, which is the whole parity claim: a route that added a guard of its own would
			// narrow REST below GraphQL and is caught here.
			expect([...guardsOfRoute(RolePermissionController, handler), FeatureFlagGuard]).toEqual(stated);
		}
	});

	it('states on the class the permission the controller states on the class', () => {
		expect(Reflect.getMetadata(PERMISSIONS_METADATA, RolePermissionResolver)).toEqual(
			Reflect.getMetadata(PERMISSIONS_METADATA, RolePermissionController)
		);
		expect(Reflect.getMetadata(PERMISSIONS_METADATA, RolePermissionResolver)).toEqual([
			PermissionsEnum.CHANGE_ROLES_PERMISSIONS
		]);
	});

	it.each(ROUTE_PARITY)('$field states the permission $route runs under', ({ field, route }) => {
		expect(permissionOfField(field)).toEqual(permissionOfRoute(RolePermissionController, route));
	});

	it('serves the caller’s own permissions as far as their route does, and no further', () => {
		// The route is the one place this controller states a permission of its own, and what it states
		// is an empty set — the administrative permission its class carries is overridden for this
		// handler, because every caller must be able to read the permissions of the role it acts in. A
		// field that inherited the class-level permission would refuse every caller that is not an
		// administrator, which is the narrowing the two-protocol rule forbids.
		expect(Reflect.getMetadata(PERMISSIONS_METADATA, RolePermissionController.prototype.findMePermissions)).toEqual(
			[]
		);
		expect(permissionOfField('myRolePermissions')).toEqual([]);
	});
});

describe('RolePermissionModule — the resolver is declared where its dependencies are reachable', () => {
	it('declares the resolver as a provider of the module that owns the service', () => {
		const providers = (Reflect.getMetadata(MODULE_METADATA.PROVIDERS, RolePermissionModule) ?? []) as unknown[];

		expect(providers).toContain(RolePermissionResolver);
		expect(providers).toContain(RolePermissionService);
	});

	it('exports the service the resolver injects, so the module that hosts it can resolve it', () => {
		// A resolver is a provider of whichever module the Apollo configuration names, so a module that
		// imports this one receives what this one hands on and nothing else.
		const exported = (Reflect.getMetadata(MODULE_METADATA.EXPORTS, RolePermissionModule) ?? []) as unknown[];

		expect(exported).toContain(RolePermissionService);
		expect(exported).toContain(RolePermissionResolver);
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
		getHandler: () => (RolePermissionResolver.prototype as never)[field],
		getClass: () => RolePermissionResolver,
		getType: () => 'graphql',
		getArgByIndex: () => ({ fieldName: field })
	} as unknown as ExecutionContext;
}

describe('RolePermissionResolver — a capability that is switched off is not served', () => {
	it('carries the gate on the class, beside the guard chain its own routes run under', () => {
		// One statement, read by the guard with `getAllAndOverride` over the handler and then the class,
		// so every field is behind it — and appended to the chain the routes already carry, never in
		// place of any part of it.
		expect(Reflect.getMetadata(FEATURE_METADATA, RolePermissionResolver)).toBe(FEATURE_GRAPHQL);
		expect(Reflect.getMetadata('__guards__', RolePermissionResolver)).toEqual([
			TenantPermissionGuard,
			PermissionGuard,
			FeatureFlagGuard
		]);
	});

	it('refuses a field whose capability is switched off, and names the field it refused', async () => {
		const { guard, featureService } = gate(false);

		const refusal = await guard.canActivate(graphqlContext('rolePermissions')).catch((thrown) => thrown);

		// The code the guard resolved is the one this resolver declared, not a second copy of it.
		expect(featureService.isFeatureEnabled).toHaveBeenCalledWith(FEATURE_GRAPHQL);
		expect(refusal).toBeInstanceOf(NotFoundException);
		// A disabled capability answers the way a missing one does, and says which field was refused.
		expect((refusal as Error).message).toContain('rolePermissions');
		expect((refusal as NotFoundException).getStatus()).toBe(404);
	});

	it('refuses the caller’s own read under the same gate as the administrative fields', async () => {
		// The field is served without a permission, which is a statement about authorisation and not
		// about the capability: a tenant that switched the GraphQL endpoint off is not served the read
		// either.
		const { guard } = gate(false);

		const refusal = await guard.canActivate(graphqlContext('myRolePermissions')).catch((thrown) => thrown);

		expect(refusal).toBeInstanceOf(NotFoundException);
		expect((refusal as Error).message).toContain('myRolePermissions');
	});

	it('serves the field once the capability is switched on', async () => {
		const { guard } = gate(true);

		await expect(guard.canActivate(graphqlContext('rolePermissions'))).resolves.toBe(true);
	});
});
