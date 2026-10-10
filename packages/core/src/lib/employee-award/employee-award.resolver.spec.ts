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
import { PermissionsEnum } from '@gauzy/contracts';
import { FEATURE_METADATA, PERMISSIONS_METADATA } from '@gauzy/constants';
import { CursorCodec } from '../api/cursor';
import { FeatureFlagGuard, PermissionGuard, TenantPermissionGuard } from '../shared/guards';
import { EmployeeAwardController } from './employee-award.controller';
import { EmployeeAwardModule } from './employee-award.module';
import { EmployeeAwardResolver } from './employee-award.resolver';
import { EmployeeAwardService } from './employee-award.service';

/**
 * The employee award over GraphQL.
 *
 * The delivered REST routes serve an award list, one award, a count, a filing, an edit, a removal, and
 * the withdrawal and restoration of an award. This suite pins the half of the two-protocol doctrine
 * that is easy to get quietly wrong:
 *
 * - every one of those capabilities is a root field of the one composed schema, and the list is a
 *   connection with the platform's own cursor codec behind it, so a cursor obtained over REST resumes
 *   here and a refusal is the query protocol's own code;
 * - every field reaches the same service method the REST route reaches, so a client does not choose a
 *   better surface by choosing a protocol;
 * - **the guard chain and the permission are the controller's, field by field, read from the
 *   controller's own metadata** — here the class-level pair, because no handler states one of its own,
 *   including the five routes inherited from the CRUD base;
 * - the year is text because the column is text, and the employee the award is filed on is carried as
 *   the identifier that always travels rather than as a relation these reads never join;
 * - an award that is not there is `null` on the one-row field rather than a refusal.
 */

const TENANT = '00000000-0000-4000-8000-000000000001';
const ORGANIZATION = '00000000-0000-4000-8000-000000000002';
const EMPLOYEE = '00000000-0000-4000-8000-000000000003';
const OTHER_EMPLOYEE = '00000000-0000-4000-8000-000000000004';
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
		employeeId: OTHER_EMPLOYEE,
		name: 'Fastest Growing',
		year: '2026',
		createdAt: new Date('2026-03-01T10:00:00.000Z'),
		updatedAt: new Date('2026-03-01T10:00:00.000Z')
	},
	{
		id: FIRST,
		tenantId: TENANT,
		organizationId: ORGANIZATION,
		employeeId: EMPLOYEE,
		name: 'Best Workplace',
		year: '2025',
		createdAt: new Date('2026-02-01T10:00:00.000Z'),
		updatedAt: new Date('2026-02-01T10:00:00.000Z')
	}
];

/** The resolver, over a scripted service. */
function surfaces() {
	const employeeAwardService = {
		findAll: jest.fn().mockResolvedValue({ items: ROWS, total: ROWS.length }),
		findOneByIdString: jest.fn().mockResolvedValue(ROWS[0]),
		countBy: jest.fn().mockResolvedValue(ROWS.length),
		create: jest.fn().mockResolvedValue(ROWS[0]),
		update: jest.fn().mockResolvedValue({ affected: 1 }),
		delete: jest.fn().mockResolvedValue({ affected: 1 }),
		softRemove: jest.fn().mockResolvedValue({ ...ROWS[0], deletedAt: new Date('2026-04-01T10:00:00.000Z') }),
		softRecover: jest.fn().mockResolvedValue(ROWS[0])
	};

	return {
		employeeAwardService,
		resolver: new EmployeeAwardResolver(employeeAwardService as never)
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
			? /^employeeAward(s|Count)?$/
			: /^(create|update|delete|softDelete|recover)EmployeeAward$/;

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
function handlersOf(controller: typeof EmployeeAwardController): Record<string, object> {
	return controller.prototype as unknown as Record<string, object>;
}

/**
 * The permission one route runs under: what its handler states, else what its controller states.
 *
 * This is the rule the guards themselves apply — the reflector's `getAllAndOverride` over
 * `[handler, class]` — restated here, so the resolver is held to the controller's own metadata rather
 * than to a second copy of the same list written out in this file.
 */
function permissionOfRoute(controller: typeof EmployeeAwardController, handler: string): unknown {
	return (
		Reflect.getMetadata(PERMISSIONS_METADATA, handlersOf(controller)[handler]) ??
		Reflect.getMetadata(PERMISSIONS_METADATA, controller)
	);
}

/**
 * The guards one route actually runs under: the controller's chain followed by whatever the handler
 * states of its own, which is the order the guard context creator concatenates them in.
 */
function guardsOfRoute(controller: typeof EmployeeAwardController, handler: string): unknown[] {
	const declared = Reflect.getMetadata('__guards__', controller) ?? [];
	const restated = Reflect.getMetadata('__guards__', handlersOf(controller)[handler]) ?? [];

	return Array.from(new Set([...declared, ...restated]));
}

/** The permission one resolver field states, by the same override rule over the field and the class. */
function permissionOfField(field: string): unknown {
	const fields = EmployeeAwardResolver.prototype as unknown as Record<string, object>;

	return (
		Reflect.getMetadata(PERMISSIONS_METADATA, fields[field]) ??
		Reflect.getMetadata(PERMISSIONS_METADATA, EmployeeAwardResolver)
	);
}

/** The guards one resolver field runs under, the class chain first. */
function guardsOfField(field: string): unknown[] {
	const declared = Reflect.getMetadata('__guards__', EmployeeAwardResolver) ?? [];
	const restated =
		Reflect.getMetadata('__guards__', (EmployeeAwardResolver.prototype as unknown as Record<string, object>)[field]) ??
		[];

	return Array.from(new Set([...declared, ...restated]));
}

describe('EmployeeAwardResolver — the SDL declares the capabilities the REST routes serve', () => {
	it('declares the connection query, the one-row query and the count', () => {
		expect(rootFields('Query')).toEqual(
			expect.arrayContaining(['employeeAwards', 'employeeAward', 'employeeAwardCount'])
		);
	});

	it('declares one mutation per delivered write route', () => {
		expect(rootFields('Mutation')).toEqual(
			expect.arrayContaining([
				'createEmployeeAward',
				'updateEmployeeAward',
				'deleteEmployeeAward',
				'softDeleteEmployeeAward',
				'recoverEmployeeAward'
			])
		);
	});

	it('declares the reads and the writes the controller serves, and no more', () => {
		// The controller serves its list twice — `GET /` and `GET /pagination` — and the two answer one
		// question, so the surface states it once: a second root field for the paginated spelling would
		// be a second surface that could disagree with this one.
		expect(ownedRootFields('Query')).toEqual(['employeeAward', 'employeeAwardCount', 'employeeAwards']);
		expect(ownedRootFields('Mutation')).toEqual([
			'createEmployeeAward',
			'deleteEmployeeAward',
			'recoverEmployeeAward',
			'softDeleteEmployeeAward',
			'updateEmployeeAward'
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
			expect(typeof handlersOf(EmployeeAwardController)[handler]).toBe('function');
		}
	});

	it('declares the connection, its edges, its filters and its sorts', () => {
		expect(printed).toMatch(
			/type EmployeeAwardConnection \{\s*nodes: \[EmployeeAward!\]!\s*edges: \[EmployeeAwardEdge!\]!\s*totalCount: Int!\s*pageInfo: PageInfo!\s*\}/
		);
		expect(printed).toMatch(/type EmployeeAwardEdge \{\s*node: EmployeeAward!\s*cursor: String!\s*\}/);
		expect(printed).toMatch(/input EmployeeAwardFilter \{/);
		expect(printed).toMatch(/input EmployeeAwardSort \{/);
		expect(printed).toMatch(
			/enum EmployeeAwardSortField \{\s*id\s*name\s*year\s*employeeId\s*tenantId\s*organizationId\s*isActive\s*isArchived\s*createdAt\s*updatedAt\s*deletedAt\s*\}/
		);
	});

	it('carries the row’s own members and the identifier in place of the relation the read does not join', () => {
		const body = typeBody('EmployeeAward');

		expect(body).toMatch(/name: String!/);
		// The year is text in the column, so it is text here: declaring it a number would refuse the
		// values the delivered write already stores.
		expect(body).toMatch(/year: String!/);
		// The identifier always travels; the employee row is joined by neither delivered read.
		expect(body).toMatch(/employeeId: ID/);
		expect(body).not.toMatch(/\n\s*employee\s*:/);
		expect(body).toMatch(/organizationId: ID/);
		expect(body).toMatch(/tenantId: ID/);
		// Withdrawing and restoring are delivered routes whose whole effect is this column, so it is
		// carried: without it the answer to the write that withdrew a row would not say so.
		expect(body).toMatch(/deletedAt: DateTime/);
	});

	it('carries the members the filter declares, which are the row’s own columns and no more', () => {
		const filter = inputBody('EmployeeAwardFilter');
		const groups = ['and', 'or', 'not'];

		// The filter is generated from the resolver's own declaration, so a member that is filterable in
		// the schema but unknown to the evaluator — or the reverse — cannot be introduced quietly.
		expect(
			(filter.match(/^\s*(\w+)\s*:/gm) ?? [])
				.map((line) => line.trim().replace(/:$/, ''))
				.filter((member) => !groups.includes(member))
		).toEqual([
			'id',
			'name',
			'year',
			'employeeId',
			'tenantId',
			'organizationId',
			'isActive',
			'isArchived',
			'createdAt',
			'updatedAt',
			'deletedAt'
		]);
		expect(filter).toMatch(/employeeId: IDFilter/);
		expect(filter).toMatch(/year: StringFilter/);
	});

	it('answers the count through a nullable field of its own and takes no argument it cannot honour', () => {
		// `GET /count` answers a bare number, which is not a connection and is not the connection's
		// `totalCount`: that total is the count of the rows the connection narrowed to, while the count
		// route counts the caller's own rows. Nullable, because an aggregate the resource has no answer
		// for must not be answered as a zero.
		expect(printed).toMatch(/employeeAwardCount: Int\n/);
		expect(printed).not.toMatch(/employeeAwardCount: Int!/);
		expect(fieldArgs('Query', 'employeeAwardCount')).toEqual([]);
		expect(printed).not.toMatch(/employeeAwardCount\(/);

		// The delivered list method reads live rows only, so the connection offers no `withDeleted`.
		expect(printed).toMatch(/employeeAwards\([^)]*withDeleted/);
		expect(fieldArgs('Query', 'employeeAwards')).toEqual([
			'filter',
			'sort',
			'page',
			'first',
			'after',
			'last',
			'before',
			'limit',
			'offset',
			'withDeleted',
		]);
	});

	it('declares the write inputs the two write mutations take', () => {
		expect(printed).toMatch(/input CreateEmployeeAwardInput \{/);
		expect(printed).toMatch(/input UpdateEmployeeAwardInput \{/);
		// The employee identifies whose award it is, so the filing states one and the edit does not: the
		// delivered update body carries no employee member, and moving an award is a removal and a filing.
		expect(inputBody('CreateEmployeeAwardInput')).toMatch(/employeeId: ID!/);
		expect(inputBody('UpdateEmployeeAwardInput')).not.toMatch(/\n\s*employeeId\s*:/);
		expect(inputBody('UpdateEmployeeAwardInput')).toMatch(/id: ID!/);
		// The tenant is stamped from the credential on every write here.
		expect(inputBody('CreateEmployeeAwardInput')).not.toMatch(/\n\s*tenantId\s*:/);
	});
});

describe('EmployeeAwardResolver — the connection contract', () => {
	it('answers the list with nodes, edges, a total and the boundary cursors', async () => {
		const { resolver, employeeAwardService } = surfaces();

		const connection = await resolver.employeeAwards(undefined, undefined, undefined, 20);

		// The read is the one the REST list route performs: `{ where: params.where }` with no query
		// string bound, which is no `where` at all.
		expect(employeeAwardService.findAll).toHaveBeenCalledWith({ where: undefined });
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

		const connection = await resolver.employeeAwards();

		expect(connection.nodes.map((node) => node.id)).toEqual([SECOND, FIRST]);
	});

	it('narrows by the fields the filter declares', async () => {
		const { resolver } = surfaces();

		const byYear = await resolver.employeeAwards({ year: { eq: '2025' } });
		expect(byYear.nodes.map((node) => node.id)).toEqual([FIRST]);

		// The employee the award is filed on is a column of the row, which is what makes the awards of
		// one person a question this surface answers without joining anything.
		const byEmployee = await resolver.employeeAwards({ employeeId: { eq: OTHER_EMPLOYEE } });
		expect(byEmployee.nodes.map((node) => node.id)).toEqual([SECOND]);

		const byName = await resolver.employeeAwards({ name: { ilike: 'best%' } });
		expect(byName.nodes.map((node) => node.id)).toEqual([FIRST]);

		// The withdrawal column is filterable, so the live rows and the withdrawn ones can be told apart.
		expect((await resolver.employeeAwards({ deletedAt: { isNull: true } })).totalCount).toBe(2);
		expect((await resolver.employeeAwards({ deletedAt: { isNull: false } })).totalCount).toBe(0);
	});

	it('orders by the keys the sort enum offers', async () => {
		const { resolver } = surfaces();

		const byName = await resolver.employeeAwards(undefined, [{ field: 'name', direction: 'ASC' }]);
		expect(byName.nodes.map((node) => node.id)).toEqual([FIRST, SECOND]);

		const byYear = await resolver.employeeAwards(undefined, [{ field: 'year', direction: 'ASC' }]);
		expect(byYear.nodes.map((node) => node.id)).toEqual([FIRST, SECOND]);
	});

	it('resumes a walk from an opaque cursor, forwards', async () => {
		const { resolver } = surfaces();
		const first = await resolver.employeeAwards(undefined, undefined, undefined, 1);

		expect(first.nodes.map((node) => node.id)).toEqual([SECOND]);
		expect(first.pageInfo.hasNextPage).toBe(true);

		const second = await resolver.employeeAwards(undefined, undefined, {
			first: 1,
			after: first.pageInfo.endCursor ?? undefined
		});

		expect(second.nodes.map((node) => node.id)).toEqual([FIRST]);
		expect(second.pageInfo.hasPreviousPage).toBe(true);
	});

	it('walks backwards from a cursor as well as forwards', async () => {
		const { resolver } = surfaces();
		const all = await resolver.employeeAwards(undefined, undefined, undefined, 20);

		const last = await resolver.employeeAwards(undefined, undefined, {
			last: 1,
			before: all.edges[1].cursor
		});

		expect(last.nodes.map((node) => node.id)).toEqual([SECOND]);
		expect(last.pageInfo.hasNextPage).toBe(true);
	});

	it('refuses a sort field the resource does not declare, with the query protocol’s own code', async () => {
		const { resolver } = surfaces();

		const error = await resolver
			.employeeAwards(undefined, [{ field: 'archivedAt', direction: 'ASC' }] as never)
			.catch((thrown) => thrown);

		expect(isRefusal(error)).toBe(true);
		expect((error as Error).message).toContain('QUERY_SORT_NOT_ALLOWED');
	});

	it('refuses a filter field the resource does not declare', async () => {
		const { resolver } = surfaces();

		const error = await resolver.employeeAwards({ employee: { eq: EMPLOYEE } }).catch((thrown) => thrown);

		expect(isRefusal(error)).toBe(true);
		expect((error as Error).message).toContain('QUERY_UNKNOWN_FILTER_FIELD');
	});

	it('refuses both pagination styles at once rather than silently preferring one', async () => {
		const { resolver } = surfaces();

		const error = await resolver
			.employeeAwards(undefined, undefined, undefined, 5, undefined, undefined, undefined, 5)
			.catch((thrown) => thrown);

		expect(isRefusal(error)).toBe(true);
		expect((error as Error).message).toContain('QUERY_NESTING_LIMIT_EXCEEDED');
	});
});

describe('EmployeeAwardResolver — one concept, two protocols, the same operations', () => {
	it('reads one award through the same service method the REST route calls', async () => {
		const { resolver, employeeAwardService } = surfaces();

		expect(await resolver.employeeAward(SECOND)).toBe(ROWS[0]);
		expect(employeeAwardService.findOneByIdString).toHaveBeenCalledWith(SECOND);
	});

	it('answers null for an award that is not there, which is the REST route’s 404 in this vocabulary', async () => {
		const { resolver, employeeAwardService } = surfaces();
		employeeAwardService.findOneByIdString.mockRejectedValueOnce(new NotFoundException());

		expect(await resolver.employeeAward(FIRST)).toBeNull();
	});

	it('counts through the same service method the count route calls, with the route’s own options', async () => {
		const { resolver, employeeAwardService } = surfaces();

		expect(await resolver.employeeAwardCount()).toBe(2);
		expect(employeeAwardService.countBy).toHaveBeenCalledWith();
	});

	it('files an award through the same service method the REST route calls', async () => {
		const { resolver, employeeAwardService } = surfaces();

		await resolver.createEmployeeAward({
			organizationId: ORGANIZATION,
			employeeId: EMPLOYEE,
			name: 'Best Workplace',
			year: '2026'
		});

		expect(employeeAwardService.create).toHaveBeenCalledWith({
			organizationId: ORGANIZATION,
			employeeId: EMPLOYEE,
			name: 'Best Workplace',
			year: '2026'
		});
	});

	it('changes an award through the same service method the REST route calls, and answers the row', async () => {
		const { resolver, employeeAwardService } = surfaces();

		const updated = await resolver.updateEmployeeAward({
			id: SECOND,
			organizationId: ORGANIZATION,
			name: 'Fastest Growing',
			year: '2027'
		});

		// The identifier is the criterion and is not repeated in the payload, which is the shape the
		// delivered route has: the path names the row and the body carries what changes.
		expect(employeeAwardService.update).toHaveBeenCalledWith(SECOND, {
			organizationId: ORGANIZATION,
			name: 'Fastest Growing',
			year: '2027'
		});
		// The store's update result is a statement about the write rather than a row, so the answer is
		// read back through the same service.
		expect(employeeAwardService.findOneByIdString).toHaveBeenCalledWith(SECOND);
		expect(updated).toBe(ROWS[0]);
	});

	it('removes an award through the same service method the REST route calls', async () => {
		const { resolver, employeeAwardService } = surfaces();

		expect(await resolver.deleteEmployeeAward(SECOND)).toBe(true);
		expect(employeeAwardService.delete).toHaveBeenCalledWith(SECOND);
	});

	it('withdraws and restores an award through the same service methods the REST routes call', async () => {
		const { resolver, employeeAwardService } = surfaces();

		const withdrawn = await resolver.softDeleteEmployeeAward(SECOND);
		expect(withdrawn.deletedAt).toBeInstanceOf(Date);
		expect(employeeAwardService.softRemove).toHaveBeenCalledWith(SECOND);

		expect(await resolver.recoverEmployeeAward(SECOND)).toBe(ROWS[0]);
		expect(employeeAwardService.softRecover).toHaveBeenCalledWith(SECOND);
	});

	it('surfaces a refusal as a 4xx that is not a 404', async () => {
		const { resolver, employeeAwardService } = surfaces();
		const refusal = new Error('EMPLOYEE_AWARD_NOT_FOUND: no award of this tenant carries that identifier.');

		employeeAwardService.delete.mockRejectedValueOnce(refusal);

		await expect(resolver.deleteEmployeeAward(SECOND)).rejects.toBe(refusal);
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
	{ field: 'employeeAwards', route: 'findAll' },
	{ field: 'employeeAward', route: 'findById' },
	{ field: 'employeeAwardCount', route: 'getCount' },
	{ field: 'createEmployeeAward', route: 'create' },
	{ field: 'updateEmployeeAward', route: 'update' },
	{ field: 'deleteEmployeeAward', route: 'delete' },
	{ field: 'softDeleteEmployeeAward', route: 'softRemove' },
	{ field: 'recoverEmployeeAward', route: 'softRecover' }
];

describe('EmployeeAwardResolver — the guard stack and the permission are the controller’s, field by field', () => {
	it('states on the class the guards and the permission the controller states on the class', () => {
		const resolverGuards = Reflect.getMetadata('__guards__', EmployeeAwardResolver) ?? [];
		const controllerGuards = Reflect.getMetadata('__guards__', EmployeeAwardController) ?? [];

		expect(controllerGuards).toEqual(expect.arrayContaining([TenantPermissionGuard, PermissionGuard]));
		expect(resolverGuards).toEqual(expect.arrayContaining([TenantPermissionGuard, PermissionGuard]));
		// The gate is the one thing appended to the chain, and it is on the class so every field is
		// behind it.
		expect(resolverGuards).toEqual(
			expect.arrayContaining([TenantPermissionGuard, PermissionGuard, FeatureFlagGuard])
		);
		expect(Reflect.getMetadata(PERMISSIONS_METADATA, EmployeeAwardResolver)).toEqual(
			Reflect.getMetadata(PERMISSIONS_METADATA, EmployeeAwardController)
		);
		expect(Reflect.getMetadata(PERMISSIONS_METADATA, EmployeeAwardController)).toEqual([
			PermissionsEnum.PUBLIC_PAGE_EDIT,
			PermissionsEnum.ALL_ORG_EDIT
		]);
	});

	it('runs every route under the guard chain the resolver states', () => {
		const stated = Reflect.getMetadata('__guards__', EmployeeAwardResolver) ?? [];

		for (const { route } of ROUTE_PARITY) {
			// The controller's chain plus the gate on the endpoint itself and the resolver's are the same
			// set, which is the whole parity claim: a route that added a guard of its own would narrow
			// REST below GraphQL and is caught here.
			expect([...guardsOfRoute(EmployeeAwardController, route), FeatureFlagGuard].sort()).toEqual(
				[...stated].sort()
			);
		}
	});

	it.each(ROUTE_PARITY)('$field mirrors $route exactly', ({ field, route }) => {
		// A route that is not served at all would make the comparison meaningless, so the handler is
		// asserted to be there before the two readings are compared — inherited handlers included.
		expect(typeof handlersOf(EmployeeAwardController)[route]).toBe('function');
		expect(guardsOfField(field).sort()).toEqual(
			[...guardsOfRoute(EmployeeAwardController, route), FeatureFlagGuard].sort()
		);
		expect(permissionOfField(field)).toEqual(permissionOfRoute(EmployeeAwardController, route));
	});

	it('states the controller’s class-level pair on every field, because that is what every route resolves to', () => {
		// No handler states a permission of its own — not the four the controller declares and not the
		// five it inherits — so `getAllAndOverride` answers the class pair for every one of them, and each
		// field states the same pair rather than a scope of its own.
		for (const { route } of ROUTE_PARITY) {
			expect(Reflect.getMetadata(PERMISSIONS_METADATA, handlersOf(EmployeeAwardController)[route])).toBeUndefined();
		}

		for (const { field } of ROUTE_PARITY) {
			expect(permissionOfField(field)).toEqual([
				PermissionsEnum.PUBLIC_PAGE_EDIT,
				PermissionsEnum.ALL_ORG_EDIT
			]);
		}
	});
});

describe('EmployeeAwardModule — the resolver is declared where its dependencies are reachable', () => {
	it('declares the resolver as a provider of the module that owns the service', () => {
		const providers = (Reflect.getMetadata(MODULE_METADATA.PROVIDERS, EmployeeAwardModule) ?? []) as unknown[];

		expect(providers).toContain(EmployeeAwardResolver);
		expect(providers).toContain(EmployeeAwardService);
	});

	it('exports the service the resolver injects, which is the one dependency that leaves the module', () => {
		// The resolver is declared by the module that owns the service it calls, and the module the
		// Apollo configuration names hosts it: a provider is private until the module that declares it
		// exports it, so a module that imports this one receives the service only through this entry.
		const exported = (Reflect.getMetadata(MODULE_METADATA.EXPORTS, EmployeeAwardModule) ?? []) as unknown[];

		expect(exported).toContain(EmployeeAwardService);
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
		getHandler: () => (EmployeeAwardResolver.prototype as never)[field],
		getClass: () => EmployeeAwardResolver,
		getType: () => 'graphql',
		getArgByIndex: () => ({ fieldName: field })
	} as unknown as ExecutionContext;
}

describe('EmployeeAwardResolver — a capability that is switched off is not served', () => {
	it('declares the capability the commerce catalogue declares for this surface, on the class', () => {
		// One statement, read by the guard with `getAllAndOverride` over the handler and then the class,
		// so every field is behind it.
		expect(Reflect.getMetadata(FEATURE_METADATA, EmployeeAwardResolver)).toBe(FEATURE_GRAPHQL);
		expect(Reflect.getMetadata('__guards__', EmployeeAwardResolver)).toContain(FeatureFlagGuard);
	});

	it('refuses a field whose capability is switched off, and names the field it refused', async () => {
		const { guard, featureService } = gate(false);

		const refusal = await guard.canActivate(graphqlContext('employeeAwards')).catch((thrown) => thrown);

		// The code the guard resolved is the one this resolver declared, not a second copy of it.
		expect(featureService.isFeatureEnabled).toHaveBeenCalledWith(FEATURE_GRAPHQL);
		expect(refusal).toBeInstanceOf(NotFoundException);
		// A disabled capability answers the way a missing one does, and says which field was refused.
		expect((refusal as Error).message).toContain('employeeAwards');
		expect((refusal as NotFoundException).getStatus()).toBe(404);
	});

	it('serves the field once the capability is switched on', async () => {
		const { guard } = gate(true);

		await expect(guard.canActivate(graphqlContext('employeeAwards'))).resolves.toBe(true);
	});
});
