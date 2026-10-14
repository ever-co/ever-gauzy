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
import { GLOBAL_MODULE_METADATA, MODULE_METADATA } from '@nestjs/common/constants';
import { buildSchema, printSchema } from 'graphql';
import { FEATURE_METADATA, PERMISSIONS_METADATA } from '@gauzy/constants';
import { CursorCodec } from '../api/cursor';
import { FeatureFlagGuard, PermissionGuard, TenantPermissionGuard } from '../shared/guards';
import { EmployeeRecentVisitController } from './employee-recent-visit.controller';
import { EmployeeRecentVisitModule } from './employee-recent-visit.module';
import { EmployeeRecentVisitResolver } from './employee-recent-visit.resolver';
import { EmployeeRecentVisitService } from './employee-recent-visit.service';

/**
 * The recent-visit history over GraphQL.
 *
 * The delivered REST surface is one route: `GET /`, which answers a connection's worth of rows. This
 * suite pins the half of the two-protocol doctrine that is easy to get quietly wrong for a resource that
 * small:
 *
 * - **the surface is that one connection and nothing else** — no node query, no count and no write,
 *   because the controller serves none of them, and a field for any of them would be a capability REST
 *   does not have;
 * - the connection's default order is the delivered read's own — `visitedAt` descending, then the
 *   identifier — and its `totalCount` is the count of the rows that read answered rather than of every
 *   row in the store, because the read itself answers a bounded set;
 * - the field reaches the same service method the REST route reaches, with the route's own defaults, so a
 *   client does not choose a better surface by choosing a protocol;
 * - **the guard chain is the controller's and the permission is the controller's own empty statement**:
 *   both guards and an empty list are declared on the class and on no handler, so the one field has to
 *   resolve to that same empty scope rather than to a permission no route states;
 * - the employee relation the delivered read does not join is an identifier here and never a field.
 */

const TENANT = '00000000-0000-4000-8000-000000000001';
const ORGANIZATION = '00000000-0000-4000-8000-000000000002';
const EMPLOYEE = '00000000-0000-4000-8000-000000000003';
const PROJECT = '00000000-0000-4000-8000-000000000004';
const FIRST = '00000000-0000-4000-8000-000000000060';
const SECOND = '00000000-0000-4000-8000-000000000061';
const THIRD = '00000000-0000-4000-8000-000000000062';

/**
 * The rows a scripted read answers with, in the order the delivered read returns them: `visitedAt`
 * descending.
 *
 * The two rows that share an instant are listed in the order a store may well hand them back — ascending
 * by identifier — because the read fixes only `visitedAt` descending and leaves a tie to the store. The
 * connection's default order is what states the tie-break, and the suite asserts it does.
 */
const ROWS = [
	{
		id: FIRST,
		tenantId: TENANT,
		organizationId: ORGANIZATION,
		employeeId: EMPLOYEE,
		visitedAt: new Date('2026-03-03T10:00:00.000Z'),
		data: { tab: 'overview' },
		entity: 'OrganizationProject',
		entityId: PROJECT,
		isActive: true,
		isArchived: false,
		createdAt: new Date('2026-03-03T10:00:00.000Z'),
		updatedAt: new Date('2026-03-03T10:00:00.000Z')
	},
	{
		id: SECOND,
		tenantId: TENANT,
		organizationId: ORGANIZATION,
		employeeId: EMPLOYEE,
		visitedAt: new Date('2026-03-02T10:00:00.000Z'),
		data: null,
		entity: 'Task',
		entityId: PROJECT,
		isActive: true,
		isArchived: false,
		createdAt: new Date('2026-03-02T10:00:00.000Z'),
		updatedAt: new Date('2026-03-02T10:00:00.000Z')
	},
	{
		id: THIRD,
		tenantId: TENANT,
		organizationId: ORGANIZATION,
		employeeId: EMPLOYEE,
		visitedAt: new Date('2026-03-02T10:00:00.000Z'),
		data: { tab: 'members' },
		entity: 'OrganizationTeam',
		entityId: PROJECT,
		isActive: true,
		isArchived: false,
		createdAt: new Date('2026-03-01T10:00:00.000Z'),
		updatedAt: new Date('2026-03-01T10:00:00.000Z')
	}
];

/** The resolver, over a scripted service. */
function surfaces() {
	const employeeRecentVisitService = {
		findEmployeeRecentVisits: jest.fn().mockResolvedValue({ items: ROWS, total: ROWS.length })
	};

	return {
		employeeRecentVisitService,
		resolver: new EmployeeRecentVisitResolver(employeeRecentVisitService as never)
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

/** The root fields this domain contributes, which are the ones that name its concept. */
function ownedRootFields(operation: 'Query' | 'Mutation'): string[] {
	return rootFields(operation)
		.filter((field) => /employeeRecentVisit/i.test(field))
		.sort();
}

/** Every type this domain declares, so the surface it states can be asserted whole. */
function declaredTypes(): string[] {
	return Object.keys(schema.getTypeMap())
		.filter((name) => /^EmployeeRecentVisit/.test(name))
		.sort();
}

/** The arguments one root field declares, in the order a client states them. */
function fieldArgs(operation: 'Query' | 'Mutation', field: string): string[] {
	const root = schema.getType(operation) as
		| { getFields(): Record<string, { args: readonly { name: string }[] }> }
		| undefined;

	return (root?.getFields()?.[field]?.args ?? []).map((argument) => argument.name);
}

/** The members of one object type, or the members of one input type, as the schema declares them. */
function declaredFields(name: string): string[] {
	const type = schema.getType(name) as { getFields(): Record<string, unknown> } | undefined;

	return Object.keys(type?.getFields() ?? {});
}

/** The values of one enum, in the order the schema declares them. */
function enumValues(name: string): string[] {
	const type = schema.getType(name) as { getValues(): readonly { name: string }[] } | undefined;

	return (type?.getValues() ?? []).map((value) => value.name);
}

/** The printed body of one object type, so a member it must not carry can be asserted absent. */
function typeBody(name: string): string {
	return printed.match(new RegExp(`type ${name} \\{([\\s\\S]*?)\\n\\}`))?.[1] ?? '';
}

/** The handlers of the controller, as functions. */
function handlersOf(controller: typeof EmployeeRecentVisitController): Record<string, object> {
	return controller.prototype as unknown as Record<string, object>;
}

/**
 * The permission one route runs under: what its handler states, else what its controller states.
 *
 * This is the rule the guards themselves apply — the reflector's `getAllAndOverride` over
 * `[handler, class]` — restated here, so the resolver is held to the controller's own metadata rather
 * than to a second copy of the same list written out in this file.
 */
function permissionOfRoute(controller: typeof EmployeeRecentVisitController, handler: string): unknown {
	return (
		Reflect.getMetadata(PERMISSIONS_METADATA, handlersOf(controller)[handler]) ??
		Reflect.getMetadata(PERMISSIONS_METADATA, controller)
	);
}

/**
 * The guards one route actually runs under: the controller's chain followed by whatever the handler
 * states of its own, which is the order the guard context creator concatenates them in.
 */
function guardsOfRoute(controller: typeof EmployeeRecentVisitController, handler: string): unknown[] {
	const declared = Reflect.getMetadata('__guards__', controller) ?? [];
	const restated = Reflect.getMetadata('__guards__', handlersOf(controller)[handler]) ?? [];

	return Array.from(new Set([...declared, ...restated]));
}

/** The fields of the resolver, as functions. */
function fieldsOf(resolver: typeof EmployeeRecentVisitResolver): Record<string, object> {
	return resolver.prototype as unknown as Record<string, object>;
}

/** The permission one resolver field runs under, by the same override rule. */
function permissionOfField(field: string): unknown {
	return (
		Reflect.getMetadata(PERMISSIONS_METADATA, fieldsOf(EmployeeRecentVisitResolver)[field]) ??
		Reflect.getMetadata(PERMISSIONS_METADATA, EmployeeRecentVisitResolver)
	);
}

/** The guards one resolver field runs under, the class chain first. */
function guardsOfField(field: string): unknown[] {
	const declared = Reflect.getMetadata('__guards__', EmployeeRecentVisitResolver) ?? [];
	const restated = Reflect.getMetadata('__guards__', fieldsOf(EmployeeRecentVisitResolver)[field]) ?? [];

	return Array.from(new Set([...declared, ...restated]));
}

describe('EmployeeRecentVisitResolver — the SDL declares the capability the REST route serves, and no more', () => {
	it('declares the connection query', () => {
		expect(rootFields('Query')).toEqual(expect.arrayContaining(['employeeRecentVisits']));
	});

	it('declares the connection and nothing else this resource could be asked for', () => {
		// The controller serves one route, so the surface is one field: a node query would mirror a
		// `GET /:id` that does not exist, a count would mirror a `GET /count` that does not exist, and a
		// mutation would mirror a write that does not exist. Each would be a capability REST does not
		// have — the reverse of the gap this delivery exists to close.
		expect(ownedRootFields('Query')).toEqual(['employeeRecentVisits']);
		expect(ownedRootFields('Mutation')).toEqual([]);
	});

	it('declares no node query, no count and no write', () => {
		// The node query would be spelled with an identifier argument; the connection is a plural field
		// and is not it.
		expect(printed).not.toMatch(/employeeRecentVisit\(/);
		expect(printed).not.toMatch(/employeeRecentVisitCount/);
		expect(printed).not.toMatch(/employeeRecentVisit[A-Za-z]*: (Boolean|Int|EmployeeRecentVisit!)/);

		// The whole of what this domain declares is the six types below: a node type, its edge and
		// connection, and the filter, sort and sort-key enum the connection takes. An input type would be
		// a write, and there is none.
		expect(declaredTypes()).toEqual([
			'EmployeeRecentVisit',
			'EmployeeRecentVisitConnection',
			'EmployeeRecentVisitEdge',
			'EmployeeRecentVisitFilter',
			'EmployeeRecentVisitSort',
			'EmployeeRecentVisitSortField'
		]);
	});

	it('declares the one route the controller serves, and no handler beside it', () => {
		expect(typeof handlersOf(EmployeeRecentVisitController)['getEmployeeRecentVisits']).toBe('function');

		// This is not a CRUD controller: nothing it might have inherited is served, which is why nothing
		// here is mirrored as a node, a count or a write.
		for (const handler of ['findAll', 'findById', 'getCount', 'pagination', 'create', 'update', 'delete', 'softRemove', 'softRecover']) {
			expect(handlersOf(EmployeeRecentVisitController)[handler]).toBeUndefined();
		}
	});

	it('declares the connection, its edges, its filters and its sorts', () => {
		expect(printed).toMatch(
			/type EmployeeRecentVisitConnection \{\s*nodes: \[EmployeeRecentVisit!\]!\s*edges: \[EmployeeRecentVisitEdge!\]!\s*totalCount: Int!\s*pageInfo: PageInfo!\s*\}/
		);
		expect(printed).toMatch(/type EmployeeRecentVisitEdge \{\s*node: EmployeeRecentVisit!\s*cursor: String!\s*\}/);
		expect(printed).toMatch(/input EmployeeRecentVisitFilter \{/);
		expect(printed).toMatch(/input EmployeeRecentVisitSort \{/);
		expect(printed).toMatch(/enum EmployeeRecentVisitSortField \{\s*visitedAt\s*createdAt\s*updatedAt\s*entity\s*\}/);
	});

	it('takes the page the connection protocol takes, and no parameter of the route as an argument of its own', () => {
		expect(fieldArgs('Query', 'employeeRecentVisits')).toEqual([
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
		// No argument promises a page size the delivered read does not also answer, and none of them
		// restates the read's own `take`/`skip` defaults: an argument whose effect were already applied
		// below it would be an argument that lies.
		expect(printed).not.toMatch(/employeeRecentVisits\([^)]*withDeleted/);
		expect(fieldArgs('Query', 'employeeRecentVisits')).not.toEqual(expect.arrayContaining(['take', 'skip', 'relations']));
	});

	it('carries the visited instant as a member, and the employee as an identifier rather than a relation', () => {
		const body = typeBody('EmployeeRecentVisit');

		// The instant is the one column the row cannot be without: a visit that did not happen at a time
		// is not a visit, and the delivered read orders by it.
		expect(body).toMatch(/visitedAt: DateTime!/);
		// The delivered read names no `relations`, so the relation is never joined on the rows this
		// surface answers: a member for it would be absent on every row answered here.
		expect(body).not.toContain('employee:');
		expect(body).toMatch(/employeeId: ID/);
		// The payload travels as the kernel's `JSON` scalar rather than as a second projection of it.
		expect(body).toMatch(/data: JSON/);
	});

	it('carries the filterable member the payload deserves, and declares no money and no rate', () => {
		// `data` is a document column, so its filter is the document filter: an operator over the column
		// rather than a projection of what it holds.
		expect(declaredFields('EmployeeRecentVisitFilter')).toEqual([
			'id',
			'visitedAt',
			'data',
			'entity',
			'entityId',
			'employeeId',
			'tenantId',
			'organizationId',
			'isActive',
			'isArchived',
			'createdAt',
			'updatedAt',
			'and',
			'or',
			'not'
		]);
		expect(enumValues('EmployeeRecentVisitSortField')).toEqual(['visitedAt', 'createdAt', 'updatedAt', 'entity']);

		// This resource has no money column and no rate, so no member of either is declared anywhere.
		expect(printed).not.toMatch(/EmployeeRecentVisit[A-Za-z]* \{[^}]*\b(amount|rate|price|total): /);
	});
});

describe('EmployeeRecentVisitResolver — the connection contract', () => {
	it('answers the read with nodes, edges, a total and the boundary cursors', async () => {
		const { resolver, employeeRecentVisitService } = surfaces();

		const connection = await resolver.employeeRecentVisits(undefined, undefined, undefined, 20);

		// The read is the one the REST route performs when it is given no query string: the route's own
		// defaults, which is the empty DTO. The resolver does not restate them, and that is the point —
		// they are the read's, and a second copy here could disagree with it.
		expect(employeeRecentVisitService.findEmployeeRecentVisits).toHaveBeenCalledWith({});
		expect(connection.nodes).toHaveLength(ROWS.length);
		expect(connection.totalCount).toBe(ROWS.length);
		expect(connection.pageInfo.startCursor).toBe(connection.edges[0].cursor);
		expect(connection.pageInfo.endCursor).toBe(connection.edges[connection.edges.length - 1].cursor);
		expect(connection.pageInfo.hasNextPage).toBe(false);
		// The cursor is the platform's own codec, so the same cursor is valid on the REST surface.
		expect(CursorCodec.decode(connection.edges[0].cursor).id).toBe(FIRST);
	});

	it('orders most recent first when the caller states none, which is the delivered read’s own order', async () => {
		const { resolver } = surfaces();

		const connection = await resolver.employeeRecentVisits();

		// `visitedAt` descending is the order the delivered read fixes. The identifier descending is the
		// tie-break the connection states, because the read leaves a tie to the store and an order that
		// is not total is an order a cursor cannot name a row by.
		expect(connection.nodes.map((node) => node.id)).toEqual([FIRST, THIRD, SECOND]);
	});

	it('counts the rows the delivered read answered, which is the set the connection is applied to', async () => {
		const { resolver, employeeRecentVisitService } = surfaces();

		const connection = await resolver.employeeRecentVisits();

		// The read answers a bounded set — its own page defaults — and the total is the size of that set
		// after the filters select from it. A total that pretended to count beyond the set the delivered
		// read answers would be a second, disagreeing count of the same question.
		expect(employeeRecentVisitService.findEmployeeRecentVisits).toHaveBeenCalledWith({});
		expect(connection.totalCount).toBe(ROWS.length);

		const narrowed = await resolver.employeeRecentVisits({ entity: { eq: 'Task' } });

		expect(narrowed.totalCount).toBe(1);
		// The read answered the same set both times; what changed is what the filter selected from it.
		expect(employeeRecentVisitService.findEmployeeRecentVisits).toHaveBeenCalledWith({});
	});

	it('narrows by every field the filter declares, including the six the route binds', async () => {
		const { resolver } = surfaces();

		const byEntity = await resolver.employeeRecentVisits({ entity: { eq: 'OrganizationTeam' } });
		expect(byEntity.nodes.map((node) => node.id)).toEqual([THIRD]);

		const byEntityId = await resolver.employeeRecentVisits({ entityId: { eq: PROJECT } });
		expect(byEntityId.totalCount).toBe(ROWS.length);

		const byEmployee = await resolver.employeeRecentVisits({ employeeId: { eq: EMPLOYEE } });
		expect(byEmployee.totalCount).toBe(ROWS.length);

		const byOrganization = await resolver.employeeRecentVisits({ organizationId: { eq: ORGANIZATION } });
		expect(byOrganization.totalCount).toBe(ROWS.length);

		const live = await resolver.employeeRecentVisits({ isActive: { eq: true }, isArchived: { eq: false } });
		expect(live.totalCount).toBe(ROWS.length);

		// A payload a visit does not carry is the `isNull` case rather than a row that never happened.
		const withoutPayload = await resolver.employeeRecentVisits({ data: { isNull: true } });
		expect(withoutPayload.nodes.map((node) => node.id)).toEqual([SECOND]);

		const since = await resolver.employeeRecentVisits({ visitedAt: { gte: '2026-03-03T00:00:00.000Z' } });
		expect(since.nodes.map((node) => node.id)).toEqual([FIRST]);

		// Every member the input declares is one the evaluator knows: a field declared in the SDL and
		// absent from the resolver's map is exactly the drift the three declarations exist to prevent.
		for (const field of declaredFields('EmployeeRecentVisitFilter')) {
			if (['and', 'or', 'not'].includes(field)) {
				continue;
			}

			await expect(resolver.employeeRecentVisits({ [field]: { isNull: false } })).resolves.toBeDefined();
		}
	});

	it('refuses a filter field the resource does not declare, even one the type carries', async () => {
		const { resolver } = surfaces();

		// `archivedAt` is a column of the row and a member of the object type, and it is deliberately not
		// a filter member: the map is what the evaluator knows, and the refusal names it.
		const error = await resolver.employeeRecentVisits({ archivedAt: { isNull: true } }).catch((thrown) => thrown);

		expect(isRefusal(error)).toBe(true);
		expect((error as Error).message).toContain('QUERY_UNKNOWN_FILTER_FIELD');

		// A relation is not a filter path either, for the same reason it is not a member of the type.
		const relation = await resolver.employeeRecentVisits({ employee: { eq: EMPLOYEE } }).catch((thrown) => thrown);
		expect(isRefusal(relation)).toBe(true);
		expect((relation as Error).message).toContain('QUERY_UNKNOWN_FILTER_FIELD');
	});

	it('orders by every key the sort enum offers', async () => {
		const { resolver } = surfaces();

		// The delivered read answers most recent first; a caller may walk the same set the other way.
		const byVisitAscending = await resolver.employeeRecentVisits(undefined, [{ field: 'visitedAt', direction: 'ASC' }]);
		expect(byVisitAscending.nodes.map((node) => node.id)).toEqual([SECOND, THIRD, FIRST]);

		const byEntity = await resolver.employeeRecentVisits(undefined, [{ field: 'entity', direction: 'ASC' }]);
		expect(byEntity.nodes.map((node) => node.id)).toEqual([FIRST, THIRD, SECOND]);

		for (const field of enumValues('EmployeeRecentVisitSortField')) {
			await expect(
				resolver.employeeRecentVisits(undefined, [{ field, direction: 'ASC' }])
			).resolves.toBeDefined();
		}
	});

	it('resumes a walk from an opaque cursor, forwards and backwards', async () => {
		const { resolver } = surfaces();
		const first = await resolver.employeeRecentVisits(undefined, undefined, undefined, 1);

		expect(first.nodes.map((node) => node.id)).toEqual([FIRST]);

		const second = await resolver.employeeRecentVisits(undefined, undefined, {
			first: 1,
			after: first.pageInfo.endCursor ?? undefined
		});

		expect(second.nodes.map((node) => node.id)).toEqual([THIRD]);
		expect(second.pageInfo.hasPreviousPage).toBe(true);

		const all = await resolver.employeeRecentVisits(undefined, undefined, undefined, 20);
		const last = await resolver.employeeRecentVisits(undefined, undefined, {
			last: 1,
			before: all.edges[1].cursor
		});

		expect(last.nodes.map((node) => node.id)).toEqual([FIRST]);
		expect(last.pageInfo.hasNextPage).toBe(true);
	});

	it('refuses a sort field the resource does not declare, with the query protocol’s own code', async () => {
		const { resolver } = surfaces();

		// `data` is filterable and not sortable: the two declarations are separate, and this is what says
		// so rather than a comment claiming it.
		const error = await resolver
			.employeeRecentVisits(undefined, [{ field: 'data', direction: 'ASC' }] as never)
			.catch((thrown) => thrown);

		expect(isRefusal(error)).toBe(true);
		expect((error as Error).message).toContain('QUERY_SORT_NOT_ALLOWED');
	});

	it('refuses both pagination styles at once rather than silently preferring one', async () => {
		const { resolver } = surfaces();

		const error = await resolver
			.employeeRecentVisits(undefined, undefined, undefined, 5, undefined, undefined, undefined, 5)
			.catch((thrown) => thrown);

		expect(isRefusal(error)).toBe(true);
		expect((error as Error).message).toContain('QUERY_NESTING_LIMIT_EXCEEDED');
	});
});

describe('EmployeeRecentVisitResolver — one concept, two protocols, the same read', () => {
	it('reads through the same service method the REST route calls, with the route’s own defaults', async () => {
		const { resolver, employeeRecentVisitService } = surfaces();

		const connection = await resolver.employeeRecentVisits();

		// The empty DTO *is* the route's own defaults: no organization, no entity, no relations, the
		// first page of the read's own order — so the two protocols ask the service the same question.
		expect(employeeRecentVisitService.findEmployeeRecentVisits).toHaveBeenCalledWith({});
		expect(connection.totalCount).toBe(ROWS.length);
	});

	it('surfaces a refusal as a 4xx that is not a 404', async () => {
		const { resolver, employeeRecentVisitService } = surfaces();
		const refusal = new Error('QUERY_PAGE_LIMIT_EXCEEDED: page[limit] must not exceed the protocol’s cap.');

		employeeRecentVisitService.findEmployeeRecentVisits.mockRejectedValueOnce(refusal);

		await expect(resolver.employeeRecentVisits()).rejects.toBe(refusal);
	});

	it('reports a miss as an empty connection rather than as a field with nothing in it', async () => {
		const { resolver, employeeRecentVisitService } = surfaces();
		employeeRecentVisitService.findEmployeeRecentVisits.mockResolvedValueOnce({ items: [], total: 0 });

		const connection = await resolver.employeeRecentVisits();

		expect(connection.nodes).toEqual([]);
		expect(connection.totalCount).toBe(0);
		expect(connection.pageInfo.startCursor).toBeNull();
		expect(connection.pageInfo.endCursor).toBeNull();
	});

	it('answers a miss on the read itself as the refusal it is, and never as an empty page', async () => {
		const { resolver, employeeRecentVisitService } = surfaces();
		employeeRecentVisitService.findEmployeeRecentVisits.mockRejectedValueOnce(new NotFoundException());

		// A read that refuses is not a read that found nothing: swallowing it here would answer `null`
		// where the delivered route answers 404, which is a narrower protocol pretending to be a wider one.
		await expect(resolver.employeeRecentVisits()).rejects.toBeInstanceOf(NotFoundException);
	});
});

/**
 * Every root field and the delivered route it mirrors.
 *
 * The two surfaces are one capability stated twice, so the guard chain and the permission of a field are
 * read from the field and from the route's own metadata and compared, rather than restated here: a table
 * of permission names would agree with the resolver while disagreeing with the controller, which is the
 * failure this half of the doctrine exists to catch.
 */
const ROUTE_PARITY: ReadonlyArray<{ field: string; route: string }> = [
	{ field: 'employeeRecentVisits', route: 'getEmployeeRecentVisits' }
];

describe('EmployeeRecentVisitResolver — the guard stack and the permission are the controller’s', () => {
	it('states on the class the two guards the controller states on the class', () => {
		const controllerGuards = Reflect.getMetadata('__guards__', EmployeeRecentVisitController) ?? [];
		const resolverGuards = Reflect.getMetadata('__guards__', EmployeeRecentVisitResolver) ?? [];

		expect(controllerGuards).toEqual(expect.arrayContaining([TenantPermissionGuard, PermissionGuard]));
		expect(resolverGuards).toEqual(expect.arrayContaining([TenantPermissionGuard, PermissionGuard]));
		// The gate is the one addition, and it is on the class so the field below is behind it.
		expect(resolverGuards).toContain(FeatureFlagGuard);
	});

	it('states the controller’s empty permission on the class, which is a statement and not an omission', () => {
		// Both guards read this list and an empty one means "no permission required". An absent list would
		// read the same way to them and differently to a reviewer, which is why it is asserted to be an
		// empty array rather than merely falsy.
		expect(Reflect.getMetadata(PERMISSIONS_METADATA, EmployeeRecentVisitController)).toEqual([]);
		expect(Reflect.getMetadata(PERMISSIONS_METADATA, EmployeeRecentVisitResolver)).toEqual([]);
		expect(Reflect.getMetadata(PERMISSIONS_METADATA, EmployeeRecentVisitResolver)).toEqual(
			Reflect.getMetadata(PERMISSIONS_METADATA, EmployeeRecentVisitController)
		);
	});

	it('leaves the handler to the class, which is what makes the empty statement the whole scope', () => {
		// The route narrows and widens nothing: it carries no permission and no guard of its own.
		expect(
			Reflect.getMetadata(PERMISSIONS_METADATA, handlersOf(EmployeeRecentVisitController)['getEmployeeRecentVisits'])
		).toBeUndefined();
		expect(Reflect.getMetadata('__guards__', handlersOf(EmployeeRecentVisitController)['getEmployeeRecentVisits'])).toBeUndefined();
	});

	it('runs the route under the guard chain the resolver states', () => {
		const stated = Reflect.getMetadata('__guards__', EmployeeRecentVisitResolver) ?? [];

		// The controller's chain plus the gate on the endpoint itself and the resolver's are the same set,
		// which is the whole parity claim: a route that added a guard of its own would narrow REST below
		// GraphQL and is caught here.
		expect([...guardsOfRoute(EmployeeRecentVisitController, 'getEmployeeRecentVisits'), FeatureFlagGuard].sort()).toEqual(
			[...stated].sort()
		);
	});

	it.each(ROUTE_PARITY)('$field mirrors $route exactly', ({ field, route }) => {
		// A route that is not served at all would make the comparison meaningless, so the handler is
		// asserted to be there before the two readings are compared.
		expect(typeof handlersOf(EmployeeRecentVisitController)[route]).toBe('function');

		// The one addition is the gate on the endpoint itself, which the route does not carry because it
		// is not a scope: every other guard of the field's chain still has to be the route's own.
		expect(guardsOfField(field).sort()).toEqual(
			[...guardsOfRoute(EmployeeRecentVisitController, route), FeatureFlagGuard].sort()
		);
		expect(permissionOfField(field)).toEqual(permissionOfRoute(EmployeeRecentVisitController, route));
	});

	it('resolves the field to the empty list, so it is not narrower than its route', () => {
		// This is the assertion the controller's empty statement exists for: a field that demanded a
		// permission the route does not state would make GraphQL the narrower door, and it would look
		// correct in the resolver while disagreeing with the controller.
		for (const { field } of ROUTE_PARITY) {
			expect(permissionOfField(field)).toEqual([]);
			expect(permissionOfField(field)).toEqual(
				permissionOfRoute(EmployeeRecentVisitController, 'getEmployeeRecentVisits')
			);
		}
	});
});

describe('EmployeeRecentVisitModule — the resolver is declared where its dependencies are reachable', () => {
	it('declares the resolver as a provider of the module that owns the service', () => {
		const providers = (Reflect.getMetadata(MODULE_METADATA.PROVIDERS, EmployeeRecentVisitModule) ?? []) as unknown[];

		expect(providers).toContain(EmployeeRecentVisitResolver);
		expect(providers).toContain(EmployeeRecentVisitService);
	});

	it('exports the service the resolver injects, which is the whole of what it injects', () => {
		const exported = (Reflect.getMetadata(MODULE_METADATA.EXPORTS, EmployeeRecentVisitModule) ?? []) as unknown[];

		expect(exported).toContain(EmployeeRecentVisitService);
		// The resolver's dependencies are asserted rather than assumed: a resolver is an ordinary
		// provider, so a dependency this module created beside the service would have to be handed on.
		expect(Reflect.getMetadata('design:paramtypes', EmployeeRecentVisitResolver)).toEqual([
			EmployeeRecentVisitService
		]);
	});

	it('is global, which is how the field reaches the service wherever the endpoint is hosted', () => {
		expect(Reflect.getMetadata(GLOBAL_MODULE_METADATA, EmployeeRecentVisitModule)).toBe(true);
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
		getHandler: () => (EmployeeRecentVisitResolver.prototype as never)[field],
		getClass: () => EmployeeRecentVisitResolver,
		getType: () => 'graphql',
		getArgByIndex: () => ({ fieldName: field })
	} as unknown as ExecutionContext;
}

describe('EmployeeRecentVisitResolver — a capability that is switched off is not served', () => {
	it('declares the capability the commerce catalogue declares for this surface, on the class', () => {
		// One statement, read by the guard with `getAllAndOverride` over the handler and then the class,
		// so the one field is behind it — which is what makes the gate the whole of its scope.
		expect(Reflect.getMetadata(FEATURE_METADATA, EmployeeRecentVisitResolver)).toBe(FEATURE_GRAPHQL);
		expect(Reflect.getMetadata('__guards__', EmployeeRecentVisitResolver)).toContain(FeatureFlagGuard);
	});

	it('refuses the field when the capability is switched off, and names the field it refused', async () => {
		const { guard, featureService } = gate(false);

		const refusal = await guard.canActivate(graphqlContext('employeeRecentVisits')).catch((thrown) => thrown);

		// The code the guard resolved is the one this resolver declared, not a second copy of it.
		expect(featureService.isFeatureEnabled).toHaveBeenCalledWith(FEATURE_GRAPHQL);
		expect(refusal).toBeInstanceOf(NotFoundException);
		// A disabled capability answers the way a missing one does, and says which field was refused.
		expect((refusal as Error).message).toContain('employeeRecentVisits');
		expect((refusal as NotFoundException).getStatus()).toBe(404);
	});

	it('serves the field once the capability is switched on', async () => {
		const { guard } = gate(true);

		await expect(guard.canActivate(graphqlContext('employeeRecentVisits'))).resolves.toBe(true);
	});
});
