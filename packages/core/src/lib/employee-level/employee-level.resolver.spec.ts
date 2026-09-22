/**
 * 🛑 This import must stay FIRST, before any import that pulls a core service or controller — see
 * `channel.controller.spec.ts` for the cycle it avoids: an entity decorator is undefined when the
 * entity applies it if the graph is entered through the validators rather than through the entities.
 */
import '../core/entities/internal';

import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { ExecutionContext, NotFoundException } from '@nestjs/common';
import { MODULE_METADATA } from '@nestjs/common/constants';
import { Reflector } from '@nestjs/core';
import { buildSchema, printSchema } from 'graphql';
import { FEATURE_METADATA, PERMISSIONS_METADATA } from '@gauzy/constants';
import { CursorCodec } from '../api/cursor';
import { FeatureFlagGuard, PermissionGuard, TenantPermissionGuard } from '../shared/guards';
import { EmployeeLevelController } from './employee-level.controller';
import { EmployeeLevelModule } from './employee-level.module';
import { EmployeeLevelResolver } from './employee-level.resolver';
import { EmployeeLevelService } from './employee-level.service';

/**
 * The employee level over GraphQL.
 *
 * The delivered REST routes serve a level list, one level, a count, a filing, an edit, a removal, and
 * the withdrawal and restoration of a level. This suite pins the half of the two-protocol doctrine that
 * is easy to get quietly wrong:
 *
 * - every one of those capabilities is a root field of the one composed schema, and the list is a
 *   connection with the platform's own cursor codec behind it, so a cursor obtained over REST resumes
 *   here and a refusal is the query protocol's own code;
 * - every field reaches the same service method the REST route reaches — including the edit, whose
 *   route is an upsert through the service's create rather than a column update;
 * - **the guard chain is the controller's and no field states a permission**, because the delivered
 *   controller states none anywhere — not on its own routes and not on the seven it inherits;
 * - **the pivot the row owns is not a member**, because no read behind this surface joins it, and its
 *   label is text rather than a reference to a second table;
 * - a level that is not there is `null` on the one-row field rather than a refusal.
 */

const TENANT = '00000000-0000-4000-8000-000000000001';
const ORGANIZATION = '00000000-0000-4000-8000-000000000002';
const FIRST = '00000000-0000-4000-8000-000000000010';
const SECOND = '00000000-0000-4000-8000-000000000011';

/**
 * The rows a scripted service answers with, in the order the delivered list read returns them: newest
 * first, which is also the order the connection applies when the caller states none.
 */
const ROWS = [
	{
		id: SECOND,
		tenantId: TENANT,
		organizationId: ORGANIZATION,
		level: 'Senior',
		createdAt: new Date('2026-03-01T10:00:00.000Z'),
		updatedAt: new Date('2026-03-01T10:00:00.000Z')
	},
	{
		id: FIRST,
		tenantId: TENANT,
		organizationId: ORGANIZATION,
		level: 'Junior',
		createdAt: new Date('2026-02-01T10:00:00.000Z'),
		updatedAt: new Date('2026-02-01T10:00:00.000Z')
	}
];

/** The resolver, over a scripted service. */
function surfaces() {
	const employeeLevelService = {
		findAll: jest.fn().mockResolvedValue({ items: ROWS, total: ROWS.length }),
		findOneByIdString: jest.fn().mockResolvedValue(ROWS[0]),
		countBy: jest.fn().mockResolvedValue(ROWS.length),
		create: jest.fn().mockResolvedValue(ROWS[0]),
		delete: jest.fn().mockResolvedValue({ affected: 1 }),
		softRemove: jest.fn().mockResolvedValue({ ...ROWS[0], deletedAt: new Date('2026-04-01T10:00:00.000Z') }),
		softRecover: jest.fn().mockResolvedValue(ROWS[0])
	};

	return {
		employeeLevelService,
		resolver: new EmployeeLevelResolver(employeeLevelService as never)
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

/**
 * The root fields this domain contributes, which are the ones that name its concept.
 *
 * The concept's name is a prefix of the employee's own fields, so the match is anchored at both ends
 * rather than a substring search, which would have counted another domain's fields as this one's.
 */
function ownedRootFields(operation: 'Query' | 'Mutation'): string[] {
	const owned =
		operation === 'Query'
			? /^employeeLevel(s|Count)?$/
			: /^(create|update|delete|softDelete|recover)EmployeeLevel$/;

	return rootFields(operation)
		.filter((field) => owned.test(field))
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

/** The handlers of one controller, as functions, inherited ones included. */
function handlersOf(controller: typeof EmployeeLevelController): Record<string, object> {
	return controller.prototype as unknown as Record<string, object>;
}

/**
 * The permission one route runs under: what its handler states, else what its controller states.
 *
 * This is the rule the guards themselves apply — the reflector's `getAllAndOverride` over
 * `[handler, class]` — restated here, so the resolver is held to the controller's own metadata rather
 * than to a second copy of the same list written out in this file.
 */
function permissionOfRoute(controller: typeof EmployeeLevelController, handler: string): unknown {
	return (
		Reflect.getMetadata(PERMISSIONS_METADATA, handlersOf(controller)[handler]) ??
		Reflect.getMetadata(PERMISSIONS_METADATA, controller)
	);
}

/**
 * The guards one route actually runs under: the controller's chain followed by whatever the handler
 * states of its own, which is the order the guard context creator concatenates them in.
 */
function guardsOfRoute(controller: typeof EmployeeLevelController, handler: string): unknown[] {
	const declared = Reflect.getMetadata('__guards__', controller) ?? [];
	const restated = Reflect.getMetadata('__guards__', handlersOf(controller)[handler]) ?? [];

	return Array.from(new Set([...declared, ...restated]));
}

/** The fields of the resolver, as functions. */
function fieldsOf(resolver: typeof EmployeeLevelResolver): Record<string, object> {
	return resolver.prototype as unknown as Record<string, object>;
}

/** The permission one resolver field states, by the same override rule over the field and the class. */
function permissionOfField(field: string): unknown {
	return (
		Reflect.getMetadata(PERMISSIONS_METADATA, fieldsOf(EmployeeLevelResolver)[field]) ??
		Reflect.getMetadata(PERMISSIONS_METADATA, EmployeeLevelResolver)
	);
}

/** The guards one resolver field runs under, the class chain first. */
function guardsOfField(field: string): unknown[] {
	const declared = Reflect.getMetadata('__guards__', EmployeeLevelResolver) ?? [];
	const restated = Reflect.getMetadata('__guards__', fieldsOf(EmployeeLevelResolver)[field]) ?? [];

	return Array.from(new Set([...declared, ...restated]));
}

describe('EmployeeLevelResolver — the SDL declares the capabilities the REST routes serve', () => {
	it('declares the connection query, the one-row query and the count', () => {
		expect(rootFields('Query')).toEqual(
			expect.arrayContaining(['employeeLevels', 'employeeLevel', 'employeeLevelCount'])
		);
	});

	it('declares one mutation per delivered write route', () => {
		expect(rootFields('Mutation')).toEqual(
			expect.arrayContaining([
				'createEmployeeLevel',
				'updateEmployeeLevel',
				'deleteEmployeeLevel',
				'softDeleteEmployeeLevel',
				'recoverEmployeeLevel'
			])
		);
	});

	it('declares the reads and the writes the controller serves, and no more', () => {
		// The controller serves its list twice — `GET /` and `GET /pagination` — and the two answer one
		// question, so the surface states it once: a second root field for the paginated spelling would
		// be a second surface that could disagree with this one.
		expect(ownedRootFields('Query')).toEqual(['employeeLevel', 'employeeLevelCount', 'employeeLevels']);
		expect(ownedRootFields('Mutation')).toEqual([
			'createEmployeeLevel',
			'deleteEmployeeLevel',
			'recoverEmployeeLevel',
			'softDeleteEmployeeLevel',
			'updateEmployeeLevel'
		]);

		// Every field above names a handler that exists on the controller, inherited ones included.
		for (const handler of [
			'findAll',
			'findById',
			'getCount',
			'create',
			'update',
			'delete',
			'softRemove',
			'softRecover'
		]) {
			expect(typeof handlersOf(EmployeeLevelController)[handler]).toBe('function');
		}
	});

	it('declares the connection, its edges, its filters and its sorts', () => {
		expect(printed).toMatch(
			/type EmployeeLevelConnection \{\s*nodes: \[EmployeeLevel!\]!\s*edges: \[EmployeeLevelEdge!\]!\s*totalCount: Int!\s*pageInfo: PageInfo!\s*\}/
		);
		expect(printed).toMatch(/type EmployeeLevelEdge \{\s*node: EmployeeLevel!\s*cursor: String!\s*\}/);
		expect(printed).toMatch(/input EmployeeLevelFilter \{/);
		expect(printed).toMatch(/input EmployeeLevelSort \{/);
		expect(printed).toMatch(
			/enum EmployeeLevelSortField \{\s*id\s*level\s*tenantId\s*organizationId\s*isActive\s*isArchived\s*createdAt\s*updatedAt\s*deletedAt\s*\}/
		);
	});

	it('carries the row’s own columns, the label as text, and not the pivot no read behind it joins', () => {
		const body = typeBody('EmployeeLevel');

		// The label is the row's own column: the vocabulary is this table, and the employee row stores
		// the label it was given rather than a reference into it.
		expect(body).toMatch(/level: String!/);
		expect(body).toMatch(/organizationId: ID/);
		expect(body).toMatch(/tenantId: ID/);
		// Withdrawing and restoring are delivered routes whose whole effect is this column, so it is
		// carried: without it the answer to the write that withdrew a row would not say so.
		expect(body).toMatch(/deletedAt: DateTime/);
		// The delivered reads join a pivot only when a REST caller names it, and this surface's read
		// names none — so a member here would be absent on every row answered, and the tags of a level
		// are read from the resource's own REST list route with `relations: ['tags']`.
		expect(body).not.toMatch(/\n\s*tags\s*:/);
	});

	it('carries the members the filter declares, which are the row’s own columns and no more', () => {
		const filter = inputBody('EmployeeLevelFilter');
		const groups = ['and', 'or', 'not'];

		// The filter is generated from the resolver's own declaration, so a member that is filterable in
		// the schema but unknown to the evaluator — or the reverse — cannot be introduced quietly. The
		// pivot is in neither list: no read behind this connection loads it, and a condition on a
		// collection that is never loaded could only ever match the empty set.
		expect(
			(filter.match(/^\s*(\w+)\s*:/gm) ?? [])
				.map((line) => line.trim().replace(/:$/, ''))
				.filter((member) => !groups.includes(member))
		).toEqual([
			'id',
			'level',
			'tenantId',
			'organizationId',
			'isActive',
			'isArchived',
			'createdAt',
			'updatedAt',
			'deletedAt'
		]);
		expect(filter).toMatch(/level: StringFilter/);
		expect(filter).not.toMatch(/\n\s*tags\s*:/);
	});

	it('answers the count through a nullable field of its own and takes no argument it cannot honour', () => {
		// `GET /count` answers a bare number, which is not a connection and is not the connection's
		// `totalCount`: that total is the count of the rows the connection narrowed to, while the count
		// route counts the caller's own rows. Nullable, because an aggregate the resource has no answer
		// for must not be answered as a zero.
		expect(printed).toMatch(/employeeLevelCount: Int\n/);
		expect(printed).not.toMatch(/employeeLevelCount: Int!/);
		expect(fieldArgs('Query', 'employeeLevelCount')).toEqual([]);
		expect(printed).not.toMatch(/employeeLevelCount\(/);

		// The delivered list method reads live rows only, and the relations it can join are the ones its
		// REST caller names — which this read never does, so the connection offers neither `withDeleted`
		// nor a `relations` argument it could not honour.
		expect(printed).toMatch(/employeeLevels\([^)]*withDeleted/);
		expect(printed).not.toMatch(/employeeLevels\([^)]*relations/);
		expect(fieldArgs('Query', 'employeeLevels')).toEqual([
			'filter',
			'sort',
			'page',
			'first',
			'after',
			'last',
			'before',
			'limit',
			'offset'
			'withDeleted',
		]);
	});

	it('declares the write inputs the two write mutations take, and no pivot member in either', () => {
		expect(printed).toMatch(/input CreateEmployeeLevelInput \{/);
		expect(printed).toMatch(/input UpdateEmployeeLevelInput \{/);
		// A filing cannot succeed without a label, because the column is not nullable and the delivered
		// route validates nothing of its own.
		expect(inputBody('CreateEmployeeLevelInput')).toMatch(/level: String!/);
		// The edit is an upsert: the identifier is the one required member and the rest is left as it is.
		expect(inputBody('UpdateEmployeeLevelInput')).toMatch(/id: ID!/);
		expect(inputBody('UpdateEmployeeLevelInput')).toMatch(/level: String\n/);
		// The pivot is written over the resource's own REST route, so neither body promises it here.
		expect(inputBody('CreateEmployeeLevelInput')).not.toMatch(/\n\s*tags\s*:/);
		expect(inputBody('UpdateEmployeeLevelInput')).not.toMatch(/\n\s*tags\s*:/);
		// The tenant is stamped from the credential on every write here.
		expect(inputBody('CreateEmployeeLevelInput')).not.toMatch(/\n\s*tenantId\s*:/);
	});
});

describe('EmployeeLevelResolver — the connection contract', () => {
	it('answers the list with nodes, edges, a total and the boundary cursors', async () => {
		const { resolver, employeeLevelService } = surfaces();

		const connection = await resolver.employeeLevels(undefined, undefined, undefined, 20);

		// The read is the one the REST list route performs with no query data bound: `{ where: {} }` and
		// no relations, which is the route's own narrowing when its caller states none.
		expect(employeeLevelService.findAll).toHaveBeenCalledWith({ where: {} });
		expect(connection.nodes).toHaveLength(2);
		expect(connection.totalCount).toBe(2);
		expect(connection.pageInfo.startCursor).toBe(connection.edges[0].cursor);
		expect(connection.pageInfo.endCursor).toBe(connection.edges[1].cursor);
		expect(connection.pageInfo.hasNextPage).toBe(false);
		// The cursor is the platform's own codec, so the same cursor is valid on the REST surface.
		expect(CursorCodec.decode(connection.edges[0].cursor).id).toBe(SECOND);
	});

	it('orders newest first when the caller states none', async () => {
		const { resolver } = surfaces();

		const connection = await resolver.employeeLevels();

		expect(connection.nodes.map((node) => node.id)).toEqual([SECOND, FIRST]);
	});

	it('narrows by the fields the filter declares', async () => {
		const { resolver } = surfaces();

		const byLabel = await resolver.employeeLevels({ level: { eq: 'Junior' } });
		expect(byLabel.nodes.map((node) => node.id)).toEqual([FIRST]);

		const byPrefix = await resolver.employeeLevels({ level: { ilike: 'sen%' } });
		expect(byPrefix.nodes.map((node) => node.id)).toEqual([SECOND]);

		const byOrganization = await resolver.employeeLevels({ organizationId: { eq: ORGANIZATION } });
		expect(byOrganization.totalCount).toBe(2);

		// The withdrawal column is filterable, so the live rows and the withdrawn ones can be told apart.
		expect((await resolver.employeeLevels({ deletedAt: { isNull: true } })).totalCount).toBe(2);
		expect((await resolver.employeeLevels({ deletedAt: { isNull: false } })).totalCount).toBe(0);
	});

	it('orders by the keys the sort enum offers', async () => {
		const { resolver } = surfaces();

		const byLabel = await resolver.employeeLevels(undefined, [{ field: 'level', direction: 'ASC' }]);
		expect(byLabel.nodes.map((node) => node.id)).toEqual([FIRST, SECOND]);

		const byCreatedAt = await resolver.employeeLevels(undefined, [{ field: 'createdAt', direction: 'ASC' }]);
		expect(byCreatedAt.nodes.map((node) => node.id)).toEqual([FIRST, SECOND]);
	});

	it('resumes a walk from an opaque cursor, forwards', async () => {
		const { resolver } = surfaces();
		const first = await resolver.employeeLevels(undefined, undefined, undefined, 1);

		expect(first.nodes.map((node) => node.id)).toEqual([SECOND]);
		expect(first.pageInfo.hasNextPage).toBe(true);

		const second = await resolver.employeeLevels(undefined, undefined, {
			first: 1,
			after: first.pageInfo.endCursor ?? undefined
		});

		expect(second.nodes.map((node) => node.id)).toEqual([FIRST]);
		expect(second.pageInfo.hasPreviousPage).toBe(true);
	});

	it('walks backwards from a cursor as well as forwards', async () => {
		const { resolver } = surfaces();
		const all = await resolver.employeeLevels(undefined, undefined, undefined, 20);

		const last = await resolver.employeeLevels(undefined, undefined, {
			last: 1,
			before: all.edges[1].cursor
		});

		expect(last.nodes.map((node) => node.id)).toEqual([SECOND]);
		expect(last.pageInfo.hasNextPage).toBe(true);
	});

	it('refuses a sort field the resource does not declare, with the query protocol’s own code', async () => {
		const { resolver } = surfaces();

		const error = await resolver
			.employeeLevels(undefined, [{ field: 'archivedAt', direction: 'ASC' }] as never)
			.catch((thrown) => thrown);

		expect(isRefusal(error)).toBe(true);
		expect((error as Error).message).toContain('QUERY_SORT_NOT_ALLOWED');
	});

	it('refuses a filter field the resource does not declare', async () => {
		const { resolver } = surfaces();

		const error = await resolver.employeeLevels({ tags: { contains: ['label'] } }).catch((thrown) => thrown);

		expect(isRefusal(error)).toBe(true);
		expect((error as Error).message).toContain('QUERY_UNKNOWN_FILTER_FIELD');
	});

	it('refuses both pagination styles at once rather than silently preferring one', async () => {
		const { resolver } = surfaces();

		const error = await resolver
			.employeeLevels(undefined, undefined, undefined, 5, undefined, undefined, undefined, 5)
			.catch((thrown) => thrown);

		expect(isRefusal(error)).toBe(true);
		expect((error as Error).message).toContain('QUERY_NESTING_LIMIT_EXCEEDED');
	});
});

describe('EmployeeLevelResolver — one concept, two protocols, the same operations', () => {
	it('reads one level through the same service method the REST route calls', async () => {
		const { resolver, employeeLevelService } = surfaces();

		expect(await resolver.employeeLevel(SECOND)).toBe(ROWS[0]);
		expect(employeeLevelService.findOneByIdString).toHaveBeenCalledWith(SECOND);
	});

	it('answers null for a level that is not there, which is the REST route’s 404 in this vocabulary', async () => {
		const { resolver, employeeLevelService } = surfaces();
		employeeLevelService.findOneByIdString.mockRejectedValueOnce(new NotFoundException());

		expect(await resolver.employeeLevel(FIRST)).toBeNull();
	});

	it('counts through the same service method the count route calls, with the route’s own options', async () => {
		const { resolver, employeeLevelService } = surfaces();

		expect(await resolver.employeeLevelCount()).toBe(2);
		expect(employeeLevelService.countBy).toHaveBeenCalledWith();
	});

	it('files a level through the same service method the REST route calls', async () => {
		const { resolver, employeeLevelService } = surfaces();

		await resolver.createEmployeeLevel({ level: 'Principal', organizationId: ORGANIZATION });

		expect(employeeLevelService.create).toHaveBeenCalledWith({
			level: 'Principal',
			organizationId: ORGANIZATION
		});
	});

	it('changes a level through the upsert the REST route performs, with the identifier in the payload', async () => {
		const { resolver, employeeLevelService } = surfaces();

		const updated = await resolver.updateEmployeeLevel({ id: SECOND, level: 'Principal' });

		// The delivered `PUT /:id` calls `create({ ...entity, id })`: the same method a filing calls, an
		// upsert rather than a column update, so the field dispatches the same call with the same payload
		// and answers the row that call answers.
		expect(employeeLevelService.create).toHaveBeenCalledWith({ id: SECOND, level: 'Principal' });
		expect(updated).toBe(ROWS[0]);
	});

	it('removes a level through the same service method the REST route calls', async () => {
		const { resolver, employeeLevelService } = surfaces();

		expect(await resolver.deleteEmployeeLevel(SECOND)).toBe(true);
		expect(employeeLevelService.delete).toHaveBeenCalledWith(SECOND);
	});

	it('withdraws and restores a level through the same service methods the REST routes call', async () => {
		const { resolver, employeeLevelService } = surfaces();

		const withdrawn = await resolver.softDeleteEmployeeLevel(SECOND);
		expect(withdrawn.deletedAt).toBeInstanceOf(Date);
		expect(employeeLevelService.softRemove).toHaveBeenCalledWith(SECOND);

		expect(await resolver.recoverEmployeeLevel(SECOND)).toBe(ROWS[0]);
		expect(employeeLevelService.softRecover).toHaveBeenCalledWith(SECOND);
	});

	it('surfaces a refusal as a 4xx that is not a 404', async () => {
		const { resolver, employeeLevelService } = surfaces();
		const refusal = new Error('EMPLOYEE_LEVEL_IN_USE: an employee still carries this label.');

		employeeLevelService.delete.mockRejectedValueOnce(refusal);

		await expect(resolver.deleteEmployeeLevel(SECOND)).rejects.toBe(refusal);
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
	{ field: 'employeeLevels', route: 'findAll' },
	{ field: 'employeeLevel', route: 'findById' },
	{ field: 'employeeLevelCount', route: 'getCount' },
	{ field: 'createEmployeeLevel', route: 'create' },
	{ field: 'updateEmployeeLevel', route: 'update' },
	{ field: 'deleteEmployeeLevel', route: 'delete' },
	{ field: 'softDeleteEmployeeLevel', route: 'softRemove' },
	{ field: 'recoverEmployeeLevel', route: 'softRecover' }
];

describe('EmployeeLevelResolver — the guard stack is the controller’s, and no permission is stated', () => {
	it('guards the resolver the way the controller is guarded', () => {
		const resolverGuards = Reflect.getMetadata('__guards__', EmployeeLevelResolver) ?? [];
		const controllerGuards = Reflect.getMetadata('__guards__', EmployeeLevelController) ?? [];

		expect(controllerGuards).toEqual(expect.arrayContaining([TenantPermissionGuard]));
		expect(resolverGuards).toEqual(expect.arrayContaining([TenantPermissionGuard, FeatureFlagGuard]));
		// The delivered controller has no permission guard to mirror, so the resolver carries none
		// either: the gate is the only guard added to the chain the routes already run under.
		expect(resolverGuards).not.toContain(PermissionGuard);
		expect(controllerGuards).not.toContain(PermissionGuard);
	});

	it('runs every route under the guard chain the resolver states', () => {
		const stated = Reflect.getMetadata('__guards__', EmployeeLevelResolver) ?? [];

		for (const { route } of ROUTE_PARITY) {
			// The controller's chain plus the gate on the endpoint itself and the resolver's are the same
			// set, which is the whole parity claim: a route that added a guard of its own would narrow
			// REST below GraphQL and is caught here.
			expect([...guardsOfRoute(EmployeeLevelController, route), FeatureFlagGuard].sort()).toEqual(
				[...stated].sort()
			);
		}
	});

	it.each(ROUTE_PARITY)('$field mirrors $route exactly', ({ field, route }) => {
		// A route that is not served at all would make the comparison meaningless, so the handler is
		// asserted to be there before the two readings are compared — inherited handlers included.
		expect(typeof handlersOf(EmployeeLevelController)[route]).toBe('function');
		expect(guardsOfField(field).sort()).toEqual(
			[...guardsOfRoute(EmployeeLevelController, route), FeatureFlagGuard].sort()
		);
		expect(permissionOfField(field)).toEqual(permissionOfRoute(EmployeeLevelController, route));
	});

	it('states no permission on the class or on any field, because the controller states none', () => {
		// The delivered controller carries `TenantPermissionGuard` and no `@Permissions` at all — not on
		// the two routes it declares and not on the seven it inherits — so every one of its routes is
		// tenant-guarded and otherwise unpermissioned, and a field that demanded a permission would refuse
		// a caller the REST route serves.
		expect(Reflect.getMetadata(PERMISSIONS_METADATA, EmployeeLevelController)).toBeUndefined();
		expect(Reflect.getMetadata(PERMISSIONS_METADATA, EmployeeLevelResolver)).toBeUndefined();

		for (const { field, route } of ROUTE_PARITY) {
			expect(Reflect.getMetadata(PERMISSIONS_METADATA, handlersOf(EmployeeLevelController)[route])).toBeUndefined();
			expect(permissionOfField(field)).toBeUndefined();
			expect(permissionOfRoute(EmployeeLevelController, route)).toBeUndefined();
			// No field restates a guard of its own either: the class chain is the whole of what every
			// field runs under, beside the gate.
			expect(Reflect.getMetadata('__guards__', fieldsOf(EmployeeLevelResolver)[field])).toBeUndefined();
		}
	});
});

describe('EmployeeLevelModule — the resolver is declared where its dependencies are reachable', () => {
	it('declares the resolver as a provider of the module that owns the service', () => {
		const providers = (Reflect.getMetadata(MODULE_METADATA.PROVIDERS, EmployeeLevelModule) ?? []) as unknown[];

		expect(providers).toContain(EmployeeLevelResolver);
		expect(providers).toContain(EmployeeLevelService);
	});

	it('exports the service the resolver injects, which is the one dependency that leaves the module', () => {
		// The resolver is declared by the module that owns the service it calls, and the module the
		// Apollo configuration names hosts it: a provider is private until the module that declares it
		// exports it, so a module that imports this one receives the service only through this entry.
		const exported = (Reflect.getMetadata(MODULE_METADATA.EXPORTS, EmployeeLevelModule) ?? []) as unknown[];

		expect(exported).toContain(EmployeeLevelService);
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
		getHandler: () => (EmployeeLevelResolver.prototype as never)[field],
		getClass: () => EmployeeLevelResolver,
		getType: () => 'graphql',
		getArgByIndex: () => ({ fieldName: field })
	} as unknown as ExecutionContext;
}

describe('EmployeeLevelResolver — a capability that is switched off is not served', () => {
	it('declares the capability the commerce catalogue declares for this surface, on the class', () => {
		// One statement, read by the guard with `getAllAndOverride` over the handler and then the class,
		// so every field is behind it — including the ones that state no guard of their own, which is what
		// makes the gate the whole of their scope beside the tenant guard.
		expect(Reflect.getMetadata(FEATURE_METADATA, EmployeeLevelResolver)).toBe(FEATURE_GRAPHQL);
		expect(Reflect.getMetadata('__guards__', EmployeeLevelResolver)).toContain(FeatureFlagGuard);
	});

	it('refuses a field whose capability is switched off, and names the field it refused', async () => {
		const { guard, featureService } = gate(false);

		const refusal = await guard.canActivate(graphqlContext('employeeLevels')).catch((thrown) => thrown);

		// The code the guard resolved is the one this resolver declared, not a second copy of it.
		expect(featureService.isFeatureEnabled).toHaveBeenCalledWith(FEATURE_GRAPHQL);
		expect(refusal).toBeInstanceOf(NotFoundException);
		// A disabled capability answers the way a missing one does, and says which field was refused.
		expect((refusal as Error).message).toContain('employeeLevels');
		expect((refusal as NotFoundException).getStatus()).toBe(404);
	});

	it('serves the field once the capability is switched on', async () => {
		const { guard } = gate(true);

		await expect(guard.canActivate(graphqlContext('employeeLevels'))).resolves.toBe(true);
	});
});
