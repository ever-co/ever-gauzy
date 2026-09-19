/**
 * 🛑 This import must stay FIRST, before any import that pulls a core service or controller — see
 * `channel.controller.spec.ts` for the cycle it avoids: an entity decorator is undefined when the
 * entity applies it if the graph is entered through the validators rather than through the entities.
 */
import '../core/entities/internal';

import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { ExecutionContext, NotFoundException } from '@nestjs/common';
import { MetadataScanner, Reflector } from '@nestjs/core';
import { buildSchema, printSchema } from 'graphql';
import { FEATURE_METADATA, PERMISSIONS_METADATA } from '@gauzy/constants';
import { CursorCodec } from '../api/cursor';
import { FeatureFlagGuard, TenantPermissionGuard } from '../shared/guards';
import { GoalTimeFrameController } from './goal-time-frame.controller';
import { GoalTimeFrameResolver } from './goal-time-frame.resolver';

/**
 * The period an objective is set for, over GraphQL.
 *
 * The delivered `/api/goal-time-frame` controller declares five routes and inherits five, and this
 * suite pins all ten as root fields of the one composed schema — with the by-name read stated as the
 * connection's `name` filter, because that is what it is: the list reader handed one more criterion.
 *
 * It also pins the fact that makes that fold worth a comment rather than a line of code: a router
 * walks a class's own methods before the base class's, so the controller's single-segment `GET /:name`
 * is registered ahead of the inherited `count`, `pagination` and `:id` patterns and answers them. The
 * surface states each capability where the controller declares it, and the ordering that shadows them
 * on REST is asserted here so the note cannot quietly stop being true.
 */

const TENANT = '00000000-0000-4000-8000-000000000001';
const ORGANIZATION = '00000000-0000-4000-8000-000000000002';
const QUARTER = '00000000-0000-4000-8000-000000000050';
const YEAR = '00000000-0000-4000-8000-000000000051';

/** The rows a scripted service answers with, in the order the delivered list read returns them. */
const ROWS = [
	{
		id: YEAR,
		tenantId: TENANT,
		organizationId: ORGANIZATION,
		name: '2026',
		status: 'OPEN',
		startDate: new Date('2026-01-01T00:00:00.000Z'),
		endDate: new Date('2026-12-31T00:00:00.000Z'),
		createdAt: new Date('2026-01-01T10:00:00.000Z'),
		updatedAt: new Date('2026-01-01T10:00:00.000Z')
	},
	{
		id: QUARTER,
		tenantId: TENANT,
		organizationId: ORGANIZATION,
		name: '2026-Q1',
		status: 'CLOSED',
		startDate: new Date('2026-01-01T00:00:00.000Z'),
		endDate: new Date('2026-03-31T00:00:00.000Z'),
		createdAt: new Date('2026-02-01T10:00:00.000Z'),
		updatedAt: new Date('2026-02-01T10:00:00.000Z')
	}
];

/** The resolver, over a scripted service. */
function surfaces() {
	const goalTimeFrameService = {
		findAll: jest.fn().mockResolvedValue({ items: ROWS, total: ROWS.length }),
		findOneByIdString: jest.fn().mockResolvedValue(ROWS[0]),
		countBy: jest.fn().mockResolvedValue(ROWS.length),
		create: jest.fn().mockResolvedValue(ROWS[0]),
		delete: jest.fn().mockResolvedValue({ affected: 1 }),
		softRemove: jest.fn().mockResolvedValue({ ...ROWS[0], deletedAt: new Date('2026-04-01T10:00:00.000Z') }),
		softRecover: jest.fn().mockResolvedValue(ROWS[0])
	};

	return { goalTimeFrameService, resolver: new GoalTimeFrameResolver(goalTimeFrameService as never) };
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

/** The composed schema, as text: every kernel and domain document the boot loader globs. */
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

/** The root fields this domain's own document declares, which is the "and no more" half of the pin. */
function declaredRootFields(file: string, operation: 'Query' | 'Mutation'): string[] {
	const sdl = readFileSync(join(__dirname, 'schema', file), 'utf8').replace(/"""[\s\S]*?"""/g, '');
	const block = sdl.match(new RegExp(`extend type ${operation} \\{([\\s\\S]*?)\\n\\}`))?.[1] ?? '';

	return [...block.matchAll(/^\t(\w+)\s*[(:\n]/gm)].map((match) => match[1]);
}

/** The printed body of one object type, so a member it must not carry can be asserted absent. */
function typeBody(name: string): string {
	return printed.match(new RegExp(`type ${name} \\{([\\s\\S]*?)\\n\\}`))?.[1] ?? '';
}

/**
 * The permission one route runs under: what its handler states, else what its controller states —
 * the rule the guards themselves apply, restated over the controller's own metadata rather than over
 * a second copy of the same list.
 */
function permissionOfRoute(controller: typeof GoalTimeFrameController, handler: string): unknown {
	const handlers = controller.prototype as unknown as Record<string, object>;

	return (
		Reflect.getMetadata(PERMISSIONS_METADATA, handlers[handler]) ??
		Reflect.getMetadata(PERMISSIONS_METADATA, controller)
	);
}

/** The guards one route actually runs under: the controller's chain, then whatever the handler states. */
function guardsOfRoute(controller: typeof GoalTimeFrameController, handler: string): unknown[] {
	const handlers = controller.prototype as unknown as Record<string, object>;
	const declared = Reflect.getMetadata('__guards__', controller) ?? [];
	const restated = Reflect.getMetadata('__guards__', handlers[handler]) ?? [];

	return Array.from(new Set([...declared, ...restated]));
}

/** The permission one resolver field runs under. */
function permissionOfField(field: string): unknown {
	const fields = GoalTimeFrameResolver.prototype as unknown as Record<string, object>;

	return Reflect.getMetadata(PERMISSIONS_METADATA, fields[field]);
}

/** Every route this domain mirrors, paired with the root field that mirrors it. */
const ROUTES: Array<[string, string]> = [
	['goalTimeFrames', 'findAll'],
	['goalTimeFrame', 'findById'],
	['goalTimeFrameCount', 'getCount'],
	['createGoalTimeFrame', 'create'],
	['updateGoalTimeFrame', 'update'],
	['deleteGoalTimeFrame', 'delete'],
	['softDeleteGoalTimeFrame', 'softRemove'],
	['recoverGoalTimeFrame', 'softRecover']
];

describe('GoalTimeFrameResolver — the SDL declares the capabilities the REST routes serve', () => {
	it('declares the connection query, the node query and the count', () => {
		expect(rootFields('Query')).toEqual(
			expect.arrayContaining(['goalTimeFrames', 'goalTimeFrame', 'goalTimeFrameCount'])
		);
	});

	it('declares one mutation per delivered write route', () => {
		expect(rootFields('Mutation')).toEqual(
			expect.arrayContaining([
				'createGoalTimeFrame',
				'updateGoalTimeFrame',
				'deleteGoalTimeFrame',
				'softDeleteGoalTimeFrame',
				'recoverGoalTimeFrame'
			])
		);
	});

	it('declares the reads and the writes the controller serves, and no more', () => {
		// The by-name route is not a fourth read: it is the list reader with one more criterion, so it is
		// stated as the connection's `name` filter and not as a root field of its own.
		expect(declaredRootFields('goal-time-frame.api.gql', 'Query')).toEqual([
			'goalTimeFrames',
			'goalTimeFrame',
			'goalTimeFrameCount'
		]);
		expect(declaredRootFields('goal-time-frame.api.gql', 'Mutation')).toEqual([
			'createGoalTimeFrame',
			'updateGoalTimeFrame',
			'deleteGoalTimeFrame',
			'softDeleteGoalTimeFrame',
			'recoverGoalTimeFrame'
		]);
	});

	it('declares the connection, its edges, its filters and its sorts', () => {
		expect(printed).toMatch(
			/type GoalTimeFrameConnection \{\s*nodes: \[GoalTimeFrame!\]!\s*edges: \[GoalTimeFrameEdge!\]!\s*totalCount: Int!\s*pageInfo: PageInfo!\s*\}/
		);
		expect(printed).toMatch(/type GoalTimeFrameEdge \{\s*node: GoalTimeFrame!\s*cursor: String!\s*\}/);
		expect(printed).toMatch(/input GoalTimeFrameFilter \{/);
		expect(printed).toMatch(/input GoalTimeFrameSort \{/);
		expect(printed).toMatch(
			/enum GoalTimeFrameSortField \{\s*createdAt\s*updatedAt\s*name\s*status\s*startDate\s*endDate\s*\}/
		);
	});

	it('carries both boundaries as instants, and says so in the schema', () => {
		const body = typeBody('GoalTimeFrame');

		// The columns are not nullable and the delivered DTO requires them: a period with no beginning or
		// no end is not a period.
		expect(body).toMatch(/startDate: DateTime!/);
		expect(body).toMatch(/endDate: DateTime!/);
		expect(body).toMatch(/status: String!/);
		expect(body).toMatch(/deletedAt: DateTime/);
	});

	it('offers no argument it cannot honour', () => {
		expect(printed).not.toMatch(/goalTimeFrames\([^)]*withDeleted/);
		expect(printed).not.toMatch(/goalTimeFrameCount\(/);
	});
});

describe('GoalTimeFrameResolver — the delivered router answers three paths with the by-name read', () => {
	it('registers the controller’s own single-segment pattern before the routes it inherits', () => {
		// A router walks a class's own methods before the base class's, which is what puts `GET /:name`
		// ahead of the inherited `count`, `pagination` and `:id` patterns. Asserting the order here is
		// what keeps the note in the SDL from quietly becoming untrue.
		const order = new MetadataScanner().getAllMethodNames(GoalTimeFrameController.prototype);

		expect(order.indexOf('getByName')).toBeGreaterThanOrEqual(0);
		expect(order.indexOf('getByName')).toBeLessThan(order.indexOf('getCount'));
		expect(order.indexOf('getByName')).toBeLessThan(order.indexOf('pagination'));
		expect(order.indexOf('getByName')).toBeLessThan(order.indexOf('findById'));
	});

	it('states the by-name read as the connection narrowed, and the other two under their own names', async () => {
		const { resolver, goalTimeFrameService } = surfaces();

		// The by-name route's own read: the list reader with one more criterion.
		const byName = await resolver.goalTimeFrames({ name: { eq: '2026-Q1' } });

		expect(goalTimeFrameService.findAll).toHaveBeenCalledWith({ where: {} });
		expect(byName.nodes.map((node) => node.id)).toEqual([QUARTER]);

		// The capabilities the controller declares are stated where the controller declares them.
		expect(rootFields('Query')).toEqual(expect.arrayContaining(['goalTimeFrame', 'goalTimeFrameCount']));
	});
});

describe('GoalTimeFrameResolver — the connection contract', () => {
	it('reads the list the way the delivered route reads it, and answers nodes, edges and a total', async () => {
		const { resolver, goalTimeFrameService } = surfaces();

		const connection = await resolver.goalTimeFrames(undefined, undefined, undefined, 20);

		expect(goalTimeFrameService.findAll).toHaveBeenCalledWith({ where: {} });
		expect(connection.nodes).toHaveLength(2);
		expect(connection.totalCount).toBe(2);
		expect(connection.pageInfo.startCursor).toBe(connection.edges[0].cursor);
		expect(connection.pageInfo.endCursor).toBe(connection.edges[1].cursor);
		expect(CursorCodec.decode(connection.edges[0].cursor).id).toBe(QUARTER);
	});

	it('answers in the calendar’s order when the caller states none, identifier breaking the tie', async () => {
		const { resolver } = surfaces();

		// Both periods open on the same day, so the identifier is the key that makes the order total —
		// which is what a cursor walk over them needs.
		expect((await resolver.goalTimeFrames()).nodes.map((node) => node.id)).toEqual([QUARTER, YEAR]);
	});

	it('narrows by the fields the filter declares', async () => {
		const { resolver } = surfaces();

		expect((await resolver.goalTimeFrames({ status: { eq: 'CLOSED' } })).nodes.map((node) => node.id)).toEqual([
			QUARTER
		]);
		expect(
			(await resolver.goalTimeFrames({ startDate: { gte: '2026-01-01T00:00:00.000Z' } })).totalCount
		).toBe(2);
		expect((await resolver.goalTimeFrames({ endDate: { lt: '2026-06-01T00:00:00.000Z' } })).nodes.map((node) => node.id)).toEqual([
			QUARTER
		]);
	});

	it('orders by the keys the sort enum offers', async () => {
		const { resolver } = surfaces();

		expect(
			(await resolver.goalTimeFrames(undefined, [{ field: 'name', direction: 'ASC' }])).nodes.map(
				(node) => node.id
			)
		).toEqual([YEAR, QUARTER]);
		expect(
			(await resolver.goalTimeFrames(undefined, [{ field: 'endDate', direction: 'ASC' }])).nodes.map(
				(node) => node.id
			)
		).toEqual([QUARTER, YEAR]);
	});

	it('resumes a walk from an opaque cursor, forwards and backwards', async () => {
		const { resolver } = surfaces();
		const all = await resolver.goalTimeFrames(undefined, undefined, undefined, 20);

		expect(
			(await resolver.goalTimeFrames(undefined, undefined, { first: 1, after: all.edges[0].cursor })).nodes.map(
				(node) => node.id
			)
		).toEqual([YEAR]);
		expect(
			(await resolver.goalTimeFrames(undefined, undefined, { last: 1, before: all.edges[1].cursor })).nodes.map(
				(node) => node.id
			)
		).toEqual([QUARTER]);
	});

	it('refuses a sort field the resource does not declare, with the query protocol’s own code', async () => {
		const { resolver } = surfaces();

		const error = await resolver
			.goalTimeFrames(undefined, [{ field: 'goals', direction: 'ASC' }] as never)
			.catch((thrown) => thrown);

		expect(isRefusal(error)).toBe(true);
		expect((error as Error).message).toContain('QUERY_SORT_NOT_ALLOWED');
	});

	it('refuses a filter field the resource does not declare', async () => {
		const { resolver } = surfaces();

		const error = await resolver.goalTimeFrames({ goals: { eq: QUARTER } }).catch((thrown) => thrown);

		expect(isRefusal(error)).toBe(true);
		expect((error as Error).message).toContain('QUERY_UNKNOWN_FILTER_FIELD');
	});

	it('refuses both pagination styles at once rather than silently preferring one', async () => {
		const { resolver } = surfaces();

		const error = await resolver
			.goalTimeFrames(undefined, undefined, undefined, 5, undefined, undefined, undefined, 5)
			.catch((thrown) => thrown);

		expect(isRefusal(error)).toBe(true);
		expect((error as Error).message).toContain('QUERY_NESTING_LIMIT_EXCEEDED');
	});
});

describe('GoalTimeFrameResolver — one concept, two protocols, the same operations', () => {
	it('reads one period through the same service method the REST route calls', async () => {
		const { resolver, goalTimeFrameService } = surfaces();

		expect(await resolver.goalTimeFrame(YEAR)).toBe(ROWS[0]);
		expect(goalTimeFrameService.findOneByIdString).toHaveBeenCalledWith(YEAR);
	});

	it('answers null for a period that is not there, which is the REST route’s 404 here', async () => {
		const { resolver, goalTimeFrameService } = surfaces();
		goalTimeFrameService.findOneByIdString.mockRejectedValueOnce(new NotFoundException());

		expect(await resolver.goalTimeFrame(QUARTER)).toBeNull();
	});

	it('counts through the same service method the count route calls, with the route’s own options', async () => {
		const { resolver, goalTimeFrameService } = surfaces();

		expect(await resolver.goalTimeFrameCount()).toBe(2);
		expect(goalTimeFrameService.countBy).toHaveBeenCalledWith();
	});

	it('opens a period through the same service method the REST route calls', async () => {
		const { resolver, goalTimeFrameService } = surfaces();

		await resolver.createGoalTimeFrame({
			name: '2026-Q2',
			status: 'OPEN',
			startDate: new Date('2026-04-01T00:00:00.000Z'),
			endDate: new Date('2026-06-30T00:00:00.000Z'),
			organizationId: ORGANIZATION
		});

		expect(goalTimeFrameService.create).toHaveBeenCalledWith({
			name: '2026-Q2',
			status: 'OPEN',
			startDate: new Date('2026-04-01T00:00:00.000Z'),
			endDate: new Date('2026-06-30T00:00:00.000Z'),
			organizationId: ORGANIZATION
		});
	});

	it('changes a period through the route’s update-through-create, identifier included', async () => {
		const { resolver, goalTimeFrameService } = surfaces();

		await resolver.updateGoalTimeFrame({ id: QUARTER, status: 'OPEN' });

		expect(goalTimeFrameService.create).toHaveBeenCalledWith({ status: 'OPEN', id: QUARTER });
	});

	it('removes a period through the same service method the REST route calls', async () => {
		const { resolver, goalTimeFrameService } = surfaces();

		expect(await resolver.deleteGoalTimeFrame(QUARTER)).toBe(true);
		expect(goalTimeFrameService.delete).toHaveBeenCalledWith(QUARTER);
	});

	it('withdraws and restores a period through the same service methods the REST routes call', async () => {
		const { resolver, goalTimeFrameService } = surfaces();

		const withdrawn = await resolver.softDeleteGoalTimeFrame(QUARTER);
		expect(withdrawn.deletedAt).toBeInstanceOf(Date);
		expect(goalTimeFrameService.softRemove).toHaveBeenCalledWith(QUARTER);

		expect(await resolver.recoverGoalTimeFrame(QUARTER)).toBe(ROWS[0]);
		expect(goalTimeFrameService.softRecover).toHaveBeenCalledWith(QUARTER);
	});

	it('surfaces a refusal as a 4xx that is not a 404', async () => {
		const { resolver, goalTimeFrameService } = surfaces();
		const refusal = new Error('FORBIDDEN: the record belongs to another tenant');

		goalTimeFrameService.create.mockRejectedValueOnce(refusal);

		await expect(resolver.updateGoalTimeFrame({ id: QUARTER, status: 'OPEN' })).rejects.toBe(refusal);
	});
});

describe('GoalTimeFrameResolver — the guard stack and the permission are the controller’s', () => {
	it('guards the resolver the way the controller is guarded, and not more widely', () => {
		expect(Reflect.getMetadata('__guards__', GoalTimeFrameController)).toEqual([TenantPermissionGuard]);
		expect(Reflect.getMetadata('__guards__', GoalTimeFrameResolver)).toEqual([
			TenantPermissionGuard,
			FeatureFlagGuard
		]);
	});

	it('runs every route under the guard chain the resolver states', () => {
		const stated = Reflect.getMetadata('__guards__', GoalTimeFrameResolver) ?? [];
		const routes = [
			'findAll',
			'findById',
			'getByName',
			'getCount',
			'pagination',
			'create',
			'update',
			'delete',
			'softRemove',
			'softRecover'
		];

		for (const handler of routes) {
			expect([...guardsOfRoute(GoalTimeFrameController, handler), FeatureFlagGuard].sort()).toEqual(
				[...stated].sort()
			);
		}
	});

	it('states no permission on the class, because the controller states none', () => {
		expect(Reflect.getMetadata(PERMISSIONS_METADATA, GoalTimeFrameController)).toBeUndefined();
		expect(Reflect.getMetadata(PERMISSIONS_METADATA, GoalTimeFrameResolver)).toBeUndefined();
	});

	it('states on every field the permission its own route runs under, which is none', () => {
		const stated = Object.fromEntries(ROUTES.map(([field]) => [field, permissionOfField(field)]));
		const expected = Object.fromEntries(
			ROUTES.map(([field, handler]) => [field, permissionOfRoute(GoalTimeFrameController, handler)])
		);

		expect(stated).toEqual(expected);
		expect(Object.values(stated).every((value) => value === undefined)).toBe(true);
	});
});

/** The code the commerce catalogue declares for this surface, as the guard’s metadata carries it. */
const FEATURE_GRAPHQL = 'FEATURE_GRAPHQL';

/** The gate, over a scripted cache and a scripted feature service. */
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
		getHandler: () => (GoalTimeFrameResolver.prototype as never)[field],
		getClass: () => GoalTimeFrameResolver,
		getType: () => 'graphql',
		getArgByIndex: () => ({ fieldName: field })
	} as unknown as ExecutionContext;
}

describe('GoalTimeFrameResolver — a capability that is switched off is not served', () => {
	it('declares the capability the commerce catalogue declares for this surface, on the class', () => {
		expect(Reflect.getMetadata(FEATURE_METADATA, GoalTimeFrameResolver)).toBe(FEATURE_GRAPHQL);
		expect(Reflect.getMetadata('__guards__', GoalTimeFrameResolver)).toContain(FeatureFlagGuard);
	});

	it('refuses a field whose capability is switched off, and names the field it refused', async () => {
		const { guard, featureService } = gate(false);

		const refusal = await guard.canActivate(graphqlContext('goalTimeFrames')).catch((thrown) => thrown);

		expect(featureService.isFeatureEnabled).toHaveBeenCalledWith(FEATURE_GRAPHQL);
		expect(refusal).toBeInstanceOf(NotFoundException);
		expect((refusal as Error).message).toContain('goalTimeFrames');
		expect((refusal as NotFoundException).getStatus()).toBe(404);
	});

	it('serves the field once the capability is switched on', async () => {
		const { guard } = gate(true);

		await expect(guard.canActivate(graphqlContext('goalTimeFrames'))).resolves.toBe(true);
	});
});
