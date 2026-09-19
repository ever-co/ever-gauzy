/**
 * 🛑 This import must stay FIRST, before any import that pulls a core service — see
 * `channel.controller.spec.ts` for the cycle it avoids: an entity decorator is undefined when the entity
 * applies it if the graph is entered through the validators rather than through the entities.
 */
import '../core/entities/internal';

import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { ExecutionContext, NotFoundException } from '@nestjs/common';
import { METHOD_METADATA, MODULE_METADATA } from '@nestjs/common/constants';
import { Reflector } from '@nestjs/core';
import { Kind, buildSchema, parse, printSchema } from 'graphql';
import { PermissionsEnum, RolesEnum } from '@gauzy/contracts';
import { FEATURE_METADATA, PERMISSIONS_METADATA } from '@gauzy/constants';
import { CursorCodec } from '../api/cursor';
import { ApiException } from '../core/errors/api-exception';
import { FeatureFlagGuard, PermissionGuard, TenantPermissionGuard } from '../shared/guards';
import { RoleController } from './role.controller';
import { RoleModule } from './role.module';
import { RoleEntityResolver } from './role-entity.resolver';
import { RoleService } from './role.service';

/**
 * The role domain over GraphQL.
 *
 * The delivered `/api/roles` routes serve a list, one role, a look-up by options, a count, a filing,
 * a rename, a removal and the two lifecycle moves. This suite pins the half of the two-protocol
 * doctrine that is easy to get quietly wrong:
 *
 * - every one of those capabilities is a root field of the one composed schema, and the list is a
 *   connection with the platform's own cursor codec behind it, so a cursor obtained over REST resumes
 *   here and a refusal is the query protocol's own code;
 * - every field reaches the same service method the REST route reaches, so a client does not choose a
 *   better surface by choosing a protocol;
 * - **the guard chain is the controller's and every field states the permission its own route runs
 *   under** — read from the controller's own metadata rather than restated in this file, because a
 *   table of permission names written out here would agree with the resolver while disagreeing with
 *   the controller;
 * - the migration route is the one delivered route with no field, and that is asserted rather than
 *   left to be discovered: what it answers is the export-import ledger's rows, a concept this domain
 *   does not own and will not claim as a schema type of its own;
 * - the gate on the endpoint itself is carried on the class, the way the routes carry the guards —
 *   a capability an operator switches off has to be refused here exactly as a disabled capability's
 *   REST routes are refused.
 */

const TENANT = '00000000-0000-4000-8000-000000000001';
const ADMIN = '00000000-0000-4000-8000-000000000010';
const AUDITOR = '00000000-0000-4000-8000-000000000011';
const VIEWER = '00000000-0000-4000-8000-000000000012';

/**
 * The rows a scripted service answers with, in the order the delivered list method returns them: the
 * order the store holds them in, which is the order the connection has to impose one on.
 */
const ROWS = [
	{
		id: ADMIN,
		tenantId: TENANT,
		name: RolesEnum.ADMIN,
		isSystem: true,
		createdAt: new Date('2026-01-01T10:00:00.000Z'),
		updatedAt: new Date('2026-01-01T10:00:00.000Z')
	},
	{
		id: AUDITOR,
		tenantId: TENANT,
		name: 'AUDITOR',
		isSystem: false,
		createdAt: new Date('2026-03-01T10:00:00.000Z'),
		updatedAt: new Date('2026-03-01T10:00:00.000Z')
	},
	{
		id: VIEWER,
		tenantId: TENANT,
		name: RolesEnum.VIEWER,
		isSystem: true,
		createdAt: new Date('2026-02-01T10:00:00.000Z'),
		updatedAt: new Date('2026-02-01T10:00:00.000Z')
	}
];

/** The resolver, over a scripted service. */
function surfaces() {
	const roleService = {
		findAll: jest.fn().mockResolvedValue({ items: ROWS, total: ROWS.length }),
		findOneByIdString: jest.fn().mockResolvedValue(ROWS[0]),
		findOneByWhereOptions: jest.fn().mockResolvedValue(ROWS[2]),
		// Nothing holds the name a filing states until a test says otherwise: `countBy` is the read the
		// create path uses to refuse a duplicate, and the count field's own test scripts it separately.
		countBy: jest.fn().mockResolvedValue(0),
		create: jest.fn().mockResolvedValue(ROWS[1]),
		update: jest.fn().mockResolvedValue({ affected: 1 }),
		delete: jest.fn().mockResolvedValue({ affected: 1 }),
		softRemove: jest.fn().mockResolvedValue({ ...ROWS[0], deletedAt: new Date('2026-04-01T10:00:00.000Z') }),
		softRecover: jest.fn().mockResolvedValue(ROWS[0])
	};

	return { roleService, resolver: new RoleEntityResolver(roleService as never) };
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
 * The root fields one document of this domain contributes, read from the document itself.
 *
 * The composed schema is the wrong instrument for this question: it holds every domain's fields, and
 * the neighbouring role-permission domain names its own fields after the same concept. What this
 * domain contributes is what its own document declares, and reading it here is what lets the set be
 * asserted exactly — including the fields that are deliberately absent.
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
function handlersOf(controller: typeof RoleController): Record<string, object> {
	return controller.prototype as unknown as Record<string, object>;
}

/**
 * Every route the controller serves, inherited ones included.
 *
 * A route is a handler that carries the request method metadata its decorator sets; the CRUD base's
 * four routes are on the parent prototype, so the chain is walked rather than the class read alone.
 * The check is against `undefined` rather than truthiness: `RequestMethod.GET` is `0`, so a
 * truthiness test would quietly leave every read of the resource out of the set.
 */
function routesOf(controller: typeof RoleController): string[] {
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
function permissionOfRoute(controller: typeof RoleController, handler: string): unknown {
	return (
		Reflect.getMetadata(PERMISSIONS_METADATA, handlersOf(controller)[handler]) ??
		Reflect.getMetadata(PERMISSIONS_METADATA, controller)
	);
}

/**
 * The guards one route actually runs under: the controller's chain followed by whatever the handler
 * states of its own, which is the order the guard context creator concatenates them in.
 */
function guardsOfRoute(controller: typeof RoleController, handler: string): unknown[] {
	const declared = Reflect.getMetadata('__guards__', controller) ?? [];
	const restated = Reflect.getMetadata('__guards__', handlersOf(controller)[handler]) ?? [];

	return Array.from(new Set([...declared, ...restated]));
}

/** The permission one resolver field runs under. */
function permissionOfField(field: string): unknown {
	const fields = RoleEntityResolver.prototype as unknown as Record<string, object>;

	return Reflect.getMetadata(PERMISSIONS_METADATA, fields[field]);
}

describe('RoleEntityResolver — the SDL declares the capabilities the REST routes serve', () => {
	it('declares the connection, the node, the options look-up and the count', () => {
		expect(contributedRootFields('role.api.gql').query).toEqual([
			'role',
			'roleByOptions',
			'roleCount',
			'roles',
			'tenantRoles'
		]);
	});

	it('declares one mutation per delivered write route', () => {
		expect(contributedRootFields('role.api.gql').mutation).toEqual([
			'createRole',
			'deleteRole',
			'recoverRole',
			'softDeleteRole',
			'updateRole'
		]);
	});

	it('reaches every one of those fields from a root operation type of the built schema', () => {
		expect(rootFields('Query')).toEqual(
			expect.arrayContaining(['roles', 'tenantRoles', 'role', 'roleByOptions', 'roleCount'])
		);
		expect(rootFields('Mutation')).toEqual(
			expect.arrayContaining(['createRole', 'updateRole', 'deleteRole', 'softDeleteRole', 'recoverRole'])
		);
	});

	it('mirrors every delivered route, with the paginated list folded into the connection', () => {
		const mirrored = new Set(ROUTE_PARITY.map(({ route }) => route));
		const unmirrored = routesOf(RoleController).filter((route) => !mirrored.has(route));

		// Every route the controller serves, its own and the CRUD base's alike, read from the classes
		// rather than written out here.
		expect(routesOf(RoleController)).toEqual([
			'create',
			'delete',
			'findAll',
			'findById',
			'findOneRoleByOptions',
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
			/type RoleConnection \{\s*nodes: \[Role!\]!\s*edges: \[RoleEdge!\]!\s*totalCount: Int!\s*pageInfo: PageInfo!\s*\}/
		);
		expect(printed).toMatch(/type RoleEdge \{\s*node: Role!\s*cursor: String!\s*\}/);
		expect(printed).toMatch(/input RoleFilter \{/);
		expect(printed).toMatch(/input RoleSort \{/);
		expect(printed).toMatch(/enum RoleSortField \{\s*createdAt\s*updatedAt\s*name\s*isSystem\s*\}/);
	});

	it('declares the write inputs the mutations take', () => {
		expect(printed).toMatch(/input CreateRoleInput \{/);
		expect(printed).toMatch(/input UpdateRoleInput \{/);
	});

	it('carries the marker the two lifecycle mutations write, and not the relation no read loads', () => {
		const body = typeBody('Role');

		// Withdrawing and restoring are delivered routes whose whole effect is this column, so it is
		// carried: without it the answer to the write that withdrew a role would not say so.
		expect(body).toMatch(/deletedAt: DateTime/);
		// The removal is defined in terms of this column, and it is what tells a provisioned role from
		// a written one.
		expect(body).toMatch(/isSystem: Boolean/);
		// The permission rows are loaded only when a REST caller names the relation, which none of the
		// reads here does, so a member would be null on every row this surface answers.
		expect(body).not.toContain('rolePermissions');
	});

	it('offers no argument it cannot honour', () => {
		// The connection declares the query protocol's page arguments and nothing else: the delivered
		// list method reads live rows only, so `withDeleted` is deliberately absent.
		expect(fieldArgs('Query', 'tenantRoles')).toEqual([
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
		expect(fieldArgs('Query', 'roleCount')).toEqual([]);
		// The options look-up narrows by the one member the route's own query DTO narrows by.
		expect(fieldArgs('Query', 'roleByOptions')).toEqual(['name']);
	});
});

describe('RoleEntityResolver — the connection contract', () => {
	it('answers the list with nodes, edges, a total and the boundary cursors', async () => {
		const { resolver, roleService } = surfaces();

		const connection = await resolver.tenantRoles(undefined, undefined, undefined, 20);

		// The read is the one the REST list route performs, with no criterion of its own — the tenant is
		// applied to it by the service, from the credential.
		expect(roleService.findAll).toHaveBeenCalledWith();
		expect(connection.nodes).toHaveLength(3);
		expect(connection.totalCount).toBe(3);
		expect(connection.pageInfo.startCursor).toBe(connection.edges[0].cursor);
		expect(connection.pageInfo.endCursor).toBe(connection.edges[2].cursor);
		expect(connection.pageInfo.hasNextPage).toBe(false);
		// The cursor is the platform's own codec, so the same cursor is valid on the REST surface.
		expect(CursorCodec.decode(connection.edges[0].cursor).id).toBe(ADMIN);
	});

	it('orders by the resource’s own order when the caller states none', async () => {
		const { resolver } = surfaces();

		const connection = await resolver.tenantRoles();

		expect(connection.nodes.map((node) => node.name)).toEqual(['ADMIN', 'AUDITOR', 'VIEWER']);
	});

	it('narrows by the fields the filter declares', async () => {
		const { resolver } = surfaces();

		const bySystem = await resolver.tenantRoles({ isSystem: { eq: true } });
		expect(bySystem.nodes.map((node) => node.id)).toEqual([ADMIN, VIEWER]);

		const byName = await resolver.tenantRoles({ name: { ilike: 'a%' } });
		expect(byName.nodes.map((node) => node.id)).toEqual([ADMIN, AUDITOR]);

		const byId = await resolver.tenantRoles({ id: { in: [VIEWER] } });
		expect(byId.nodes.map((node) => node.id)).toEqual([VIEWER]);

		const none = await resolver.tenantRoles({ and: [{ isSystem: { eq: true } }, { name: { eq: 'AUDITOR' } }] });
		expect(none.totalCount).toBe(0);
	});

	it('orders by the keys the sort enum offers', async () => {
		const { resolver } = surfaces();

		const byName = await resolver.tenantRoles(undefined, [{ field: 'name', direction: 'DESC' }]);
		expect(byName.nodes.map((node) => node.name)).toEqual(['VIEWER', 'AUDITOR', 'ADMIN']);

		const byCreation = await resolver.tenantRoles(undefined, [{ field: 'createdAt', direction: 'DESC' }]);
		expect(byCreation.nodes.map((node) => node.id)).toEqual([AUDITOR, VIEWER, ADMIN]);

		const bySystem = await resolver.tenantRoles(undefined, [{ field: 'isSystem', direction: 'DESC' }]);
		expect(bySystem.nodes[0].isSystem).toBe(true);
	});

	it('resumes a walk from an opaque cursor', async () => {
		const { resolver } = surfaces();
		const first = await resolver.tenantRoles(undefined, undefined, undefined, 1);

		expect(first.nodes.map((node) => node.id)).toEqual([ADMIN]);

		const second = await resolver.tenantRoles(undefined, undefined, {
			first: 1,
			after: first.pageInfo.endCursor ?? undefined
		});

		expect(second.nodes.map((node) => node.id)).toEqual([AUDITOR]);
		expect(second.pageInfo.hasPreviousPage).toBe(true);
		expect(second.pageInfo.hasNextPage).toBe(true);
	});

	it('walks backwards from a cursor as well as forwards', async () => {
		const { resolver } = surfaces();
		const all = await resolver.tenantRoles(undefined, undefined, undefined, 20);

		const last = await resolver.tenantRoles(undefined, undefined, {
			last: 1,
			before: all.edges[2].cursor
		});

		expect(last.nodes.map((node) => node.id)).toEqual([AUDITOR]);
		expect(last.pageInfo.hasNextPage).toBe(true);
	});

	it('refuses a cursor this server did not mint, with the query protocol’s own code', async () => {
		const { resolver } = surfaces();
		// A well-formed base64url string that carries no sort value and no identifier: the walk cannot
		// resume from it, and the refusal is the protocol's rather than a decoder's message.
		const notACursor = Buffer.from('not-a-cursor').toString('base64url');

		const error = await resolver
			.tenantRoles(undefined, undefined, { first: 1, after: notACursor })
			.catch((thrown) => thrown);

		expect(isRefusal(error)).toBe(true);
		expect((error as Error).message).toContain('QUERY_CURSOR_INVALID');
	});

	it('refuses a cursor minted under another order rather than resuming at the wrong row', async () => {
		const { resolver } = surfaces();
		const foreign = CursorCodec.encode(ROWS[0].createdAt, ADMIN, [{ field: 'createdAt', direction: 'DESC' }]);

		const error = await resolver
			.tenantRoles(undefined, undefined, { first: 1, after: foreign })
			.catch((thrown) => thrown);

		expect(isRefusal(error)).toBe(true);
		expect((error as Error).message).toContain('QUERY_CURSOR_SORT_MISMATCH');
	});

	it('refuses a sort field the resource does not declare, with the query protocol’s own code', async () => {
		const { resolver } = surfaces();

		const error = await resolver
			.tenantRoles(undefined, [{ field: 'tenantId', direction: 'ASC' }] as never)
			.catch((thrown) => thrown);

		expect(isRefusal(error)).toBe(true);
		expect((error as Error).message).toContain('QUERY_SORT_NOT_ALLOWED');
	});

	it('refuses a filter field the resource does not declare', async () => {
		const { resolver } = surfaces();

		// The relation the type deliberately does not carry cannot be filtered on either, and the
		// refusal is the query protocol's own rather than a silent narrowing to nothing.
		const error = await resolver.tenantRoles({ rolePermissions: { eq: ADMIN } }).catch((thrown) => thrown);

		expect(isRefusal(error)).toBe(true);
		expect((error as Error).message).toContain('QUERY_UNKNOWN_FILTER_FIELD');
	});

	it('refuses both pagination styles at once rather than silently preferring one', async () => {
		const { resolver } = surfaces();

		const error = await resolver
			.tenantRoles(undefined, undefined, undefined, 5, undefined, undefined, undefined, 5)
			.catch((thrown) => thrown);

		expect(isRefusal(error)).toBe(true);
		expect((error as Error).message).toContain('QUERY_NESTING_LIMIT_EXCEEDED');
	});
});

describe('RoleEntityResolver — one concept, two protocols, the same operations', () => {
	it('refuses a credential that is not acting in a role, on the field that is declared non-nullable', async () => {
		const { resolver } = surfaces();

		// No request is in flight in this suite, so the credential names no role — which is the one
		// case the delivery declares an error for rather than a null.
		const error = await resolver.roles().catch((thrown) => thrown);

		expect(error).toBeInstanceOf(ApiException);
		expect((error as ApiException).getStatus()).toBe(404);
	});

	it('reads one role through the same service method the REST node route calls', async () => {
		const { resolver, roleService } = surfaces();

		expect(await resolver.role(ADMIN)).toBe(ROWS[0]);
		expect(roleService.findOneByIdString).toHaveBeenCalledWith(ADMIN);
	});

	it('answers null for a role that is not there, which is the REST route’s 404 in this vocabulary', async () => {
		const { resolver, roleService } = surfaces();
		roleService.findOneByIdString.mockRejectedValueOnce(new NotFoundException());

		expect(await resolver.role(AUDITOR)).toBeNull();
	});

	it('answers the options look-up through the same two reads the REST route makes, in its own order', async () => {
		const { resolver, roleService } = surfaces();

		expect(await resolver.roleByOptions()).toBe(ROWS[0]);
		// The first read is the route's own: the caller's acting role, under a criterion fixed to the
		// employee name rather than to the name the caller states.
		expect(roleService.findOneByIdString).toHaveBeenCalledWith(null, { where: { name: RolesEnum.EMPLOYEE } });
		expect(roleService.findOneByWhereOptions).not.toHaveBeenCalled();
	});

	it('falls through to the role the options select, defaulting the name as the route’s DTO does', async () => {
		const { resolver, roleService } = surfaces();
		roleService.findOneByIdString.mockRejectedValueOnce(new NotFoundException());

		expect(await resolver.roleByOptions()).toBe(ROWS[2]);
		expect(roleService.findOneByWhereOptions).toHaveBeenCalledWith({ name: RolesEnum.EMPLOYEE });

		roleService.findOneByIdString.mockRejectedValueOnce(new NotFoundException());
		await resolver.roleByOptions('AUDITOR');
		expect(roleService.findOneByWhereOptions).toHaveBeenLastCalledWith({ name: 'AUDITOR' });
	});

	it('answers null for an options look-up that selects no role, rather than the route’s refusal', async () => {
		const { resolver, roleService } = surfaces();
		roleService.findOneByIdString.mockRejectedValueOnce(new NotFoundException());
		roleService.findOneByWhereOptions.mockRejectedValueOnce(new NotFoundException());

		expect(await resolver.roleByOptions('NOT-A-ROLE')).toBeNull();
	});

	it('counts through the same service method the count route calls, with the route’s own options', async () => {
		const { resolver, roleService } = surfaces();
		roleService.countBy.mockResolvedValueOnce(ROWS.length);

		expect(await resolver.roleCount()).toBe(3);
		expect(roleService.countBy).toHaveBeenCalledWith();
	});

	it('creates a role through the same service method the REST route calls', async () => {
		const { resolver, roleService } = surfaces();

		expect(await resolver.createRole({ name: 'AUDITOR', tenantId: TENANT })).toBe(ROWS[1]);
		expect(roleService.create).toHaveBeenCalledWith({ name: 'AUDITOR' });
		// The input's own tenant is deliberately not passed on: the service stamps the credential's.
		expect(roleService.create.mock.calls[0][0]).not.toHaveProperty('tenantId');
	});

	it('refuses a second role with a name this tenant already holds, as the REST DTO does', async () => {
		const { resolver, roleService } = surfaces();
		roleService.countBy.mockResolvedValueOnce(1);

		const error = await resolver.createRole({ name: 'ADMIN', tenantId: TENANT }).catch((thrown) => thrown);

		expect(isRefusal(error)).toBe(true);
		expect(roleService.create).not.toHaveBeenCalled();
	});

	it('renames a role through the same service method the REST route calls, and reads it back', async () => {
		const { resolver, roleService } = surfaces();

		expect(await resolver.updateRole({ id: AUDITOR, name: ' Auditor ', tenantId: TENANT })).toBe(ROWS[0]);
		expect(roleService.update).toHaveBeenCalledWith(AUDITOR, { name: 'Auditor' });
		// The row is read back after the write, because the delivered route answers the store's own
		// statement about the write rather than a row.
		expect(roleService.findOneByIdString).toHaveBeenLastCalledWith(AUDITOR);
	});

	it('removes a role through the same service method the REST route calls', async () => {
		const { resolver, roleService } = surfaces();

		expect(await resolver.deleteRole(AUDITOR)).toBe(true);
		expect(roleService.delete).toHaveBeenCalledWith(AUDITOR);
	});

	it('withdraws and restores a role through the same service methods the inherited routes call', async () => {
		const { resolver, roleService } = surfaces();

		const withdrawn = await resolver.softDeleteRole(AUDITOR);
		expect(withdrawn.deletedAt).toBeInstanceOf(Date);
		expect(roleService.softRemove).toHaveBeenCalledWith(AUDITOR);

		expect(await resolver.recoverRole(AUDITOR)).toBe(ROWS[0]);
		expect(roleService.softRecover).toHaveBeenCalledWith(AUDITOR);
	});

	it('surfaces a refusal as a 4xx that is not a 404', async () => {
		const { resolver, roleService } = surfaces();
		const refusal = new Error('CANNOT_DELETE_SYSTEM_ROLE: this role is provisioned by the platform.');

		roleService.delete.mockRejectedValueOnce(refusal);

		await expect(resolver.deleteRole(ADMIN)).rejects.toBe(refusal);
	});
});

/**
 * Every root field and the delivered route it mirrors.
 *
 * The two surfaces are one capability stated twice, so the guard stack and the permission of a field
 * are read from the field and from the route's own metadata and compared, rather than restated here.
 * A field appears once per route it mirrors, and the list appears three times because the controller
 * serves it three times: `findAll` and `pagination` are two routes answering one question, and the
 * mandate is that the connection *is* that list — the paginated spelling is the connection's own page
 * rather than a capability of its own. `roles` is deliberately absent: it answers the credential's own
 * role and mirrors no route of this resource.
 */
const ROUTE_PARITY: ReadonlyArray<{ field: string; route: string }> = [
	{ field: 'tenantRoles', route: 'findAll' },
	{ field: 'tenantRoles', route: 'pagination' },
	{ field: 'role', route: 'findById' },
	{ field: 'roleByOptions', route: 'findOneRoleByOptions' },
	{ field: 'roleCount', route: 'getCount' },
	{ field: 'createRole', route: 'create' },
	{ field: 'updateRole', route: 'update' },
	{ field: 'deleteRole', route: 'delete' },
	{ field: 'softDeleteRole', route: 'softRemove' },
	{ field: 'recoverRole', route: 'softRecover' }
];

describe('RoleEntityResolver — the guard stack and the permission are the controller’s', () => {
	it('guards the resolver the way the controller is guarded, and appends the gate to that chain', () => {
		const resolverGuards = Reflect.getMetadata('__guards__', RoleEntityResolver) ?? [];
		const controllerGuards = Reflect.getMetadata('__guards__', RoleController) ?? [];

		expect(controllerGuards).toEqual([TenantPermissionGuard, PermissionGuard]);
		// One statement: the routes' own chain, with the gate on the endpoint appended rather than
		// replacing any part of it.
		expect(resolverGuards).toEqual([TenantPermissionGuard, PermissionGuard, FeatureFlagGuard]);
	});

	it('runs every route under the guard chain the resolver states', () => {
		const stated = Reflect.getMetadata('__guards__', RoleEntityResolver) ?? [];

		for (const handler of routesOf(RoleController)) {
			// The controller's chain plus the gate on the endpoint itself is the same set as the
			// resolver's, which is the whole parity claim: a route that added a guard of its own would
			// narrow REST below GraphQL and is caught here.
			expect([...guardsOfRoute(RoleController, handler), FeatureFlagGuard]).toEqual(stated);
		}
	});

	it('states on the class the permission the controller states on the class', () => {
		expect(Reflect.getMetadata(PERMISSIONS_METADATA, RoleEntityResolver)).toEqual(
			Reflect.getMetadata(PERMISSIONS_METADATA, RoleController)
		);
		expect(Reflect.getMetadata(PERMISSIONS_METADATA, RoleEntityResolver)).toEqual([
			PermissionsEnum.CHANGE_ROLES_PERMISSIONS
		]);
	});

	it.each(ROUTE_PARITY)('$field states the permission $route runs under', ({ field, route }) => {
		expect(permissionOfField(field)).toEqual(permissionOfRoute(RoleController, route));
	});

	it('permits the options look-up exactly as far as its route does, and no further', () => {
		// The route is the one place this controller states a permission of its own, and the two it
		// states are alternatives rather than a conjunction: the guard is satisfied by either, which is
		// what lets a team manager read the employee role. A field carrying the class-level permission
		// alone would refuse that caller — which is why the look-up is a field of its own rather than a
		// filter on the connection.
		expect(Reflect.getMetadata(PERMISSIONS_METADATA, RoleController.prototype.findOneRoleByOptions)).toEqual([
			PermissionsEnum.CHANGE_ROLES_PERMISSIONS,
			PermissionsEnum.ORG_TEAM_ADD
		]);
		expect(permissionOfField('roleByOptions')).toEqual([
			PermissionsEnum.CHANGE_ROLES_PERMISSIONS,
			PermissionsEnum.ORG_TEAM_ADD
		]);
	});
});

describe('RoleModule — the resolver is declared where its dependencies are reachable', () => {
	it('declares the resolver as a provider of the module that owns the service', () => {
		const providers = (Reflect.getMetadata(MODULE_METADATA.PROVIDERS, RoleModule) ?? []) as unknown[];

		expect(providers).toContain(RoleEntityResolver);
		expect(providers).toContain(RoleService);
	});

	it('exports the service the resolver injects, so the module that hosts it can resolve it', () => {
		// A resolver is a provider of whichever module the Apollo configuration names, so a module that
		// imports this one receives what this one hands on and nothing else.
		const exported = (Reflect.getMetadata(MODULE_METADATA.EXPORTS, RoleModule) ?? []) as unknown[];

		expect(exported).toContain(RoleService);
		expect(exported).toContain(RoleEntityResolver);
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
		getHandler: () => (RoleEntityResolver.prototype as never)[field],
		getClass: () => RoleEntityResolver,
		getType: () => 'graphql',
		getArgByIndex: () => ({ fieldName: field })
	} as unknown as ExecutionContext;
}

describe('RoleEntityResolver — a capability that is switched off is not served', () => {
	it('carries the gate on the class, beside the guard chain its own routes run under', () => {
		// One statement, read by the guard with `getAllAndOverride` over the handler and then the class,
		// so every field is behind it — and appended to the chain the routes already carry, never in
		// place of any part of it.
		expect(Reflect.getMetadata(FEATURE_METADATA, RoleEntityResolver)).toBe(FEATURE_GRAPHQL);
		expect(Reflect.getMetadata('__guards__', RoleEntityResolver)).toEqual([
			TenantPermissionGuard,
			PermissionGuard,
			FeatureFlagGuard
		]);
	});

	it('refuses a field whose capability is switched off, and names the field it refused', async () => {
		const { guard, featureService } = gate(false);

		const refusal = await guard.canActivate(graphqlContext('roles')).catch((thrown) => thrown);

		// The code the guard resolved is the one this resolver declared, not a second copy of it.
		expect(featureService.isFeatureEnabled).toHaveBeenCalledWith(FEATURE_GRAPHQL);
		expect(refusal).toBeInstanceOf(NotFoundException);
		// A disabled capability answers the way a missing one does, and says which field was refused.
		expect((refusal as Error).message).toContain('roles');
		expect((refusal as NotFoundException).getStatus()).toBe(404);
	});

	it('refuses the fields this delivery added under the same gate', async () => {
		const { guard } = gate(false);

		for (const field of ['tenantRoles', 'roleByOptions', 'roleCount', 'deleteRole', 'softDeleteRole', 'recoverRole']) {
			const refusal = await guard.canActivate(graphqlContext(field)).catch((thrown) => thrown);

			expect(refusal).toBeInstanceOf(NotFoundException);
			expect((refusal as Error).message).toContain(field);
		}
	});

	it('serves the field once the capability is switched on', async () => {
		const { guard } = gate(true);

		await expect(guard.canActivate(graphqlContext('roles'))).resolves.toBe(true);
	});
});
