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
import { buildSchema, printSchema } from 'graphql';
import { FEATURE_METADATA, PERMISSIONS_METADATA } from '@gauzy/constants';
import { CursorCodec } from '../api/cursor';
import { FeatureFlagGuard, TenantPermissionGuard } from '../shared/guards';
import { GoalKpiController } from './goal-kpi.controller';
import { GoalKpiResolver } from './goal-kpi.resolver';

/**
 * The measure a key result tracks, over GraphQL.
 *
 * The delivered `/api/goal-kpi` routes serve a list, a node, a count, a filing, a change, a removal and
 * the two lifecycle moves. This suite pins the half of the two-protocol doctrine that is easy to get
 * quietly wrong: every capability is a root field of the one composed schema, the list is a connection
 * behind the platform's own cursor codec, every field reaches the same service method its route
 * reaches, the guard chain and the permission are the controller's read from its own metadata, and the
 * gate answers a switched-off capability the way a missing field is answered.
 */

const TENANT = '00000000-0000-4000-8000-000000000001';
const ORGANIZATION = '00000000-0000-4000-8000-000000000002';
const SIGNUPS = '00000000-0000-4000-8000-000000000020';
const REVENUE = '00000000-0000-4000-8000-000000000021';

/** The rows a scripted service answers with, in the order the delivered list read returns them. */
const ROWS = [
	{
		id: SIGNUPS,
		tenantId: TENANT,
		organizationId: ORGANIZATION,
		name: 'Weekly sign-ups',
		description: 'The top of the funnel',
		type: 'NUMERICAL',
		unit: 'accounts',
		operator: '>=',
		currentValue: 1200,
		targetValue: 2000,
		leadId: null,
		createdAt: new Date('2026-03-01T10:00:00.000Z'),
		updatedAt: new Date('2026-03-01T10:00:00.000Z')
	},
	{
		id: REVENUE,
		tenantId: TENANT,
		organizationId: ORGANIZATION,
		name: 'Net revenue retention',
		description: 'The bottom of the funnel',
		type: 'PERCENTAGE',
		unit: '%',
		operator: '>=',
		currentValue: 104,
		targetValue: 110,
		leadId: null,
		createdAt: new Date('2026-02-01T10:00:00.000Z'),
		updatedAt: new Date('2026-02-01T10:00:00.000Z')
	}
];

/** The resolver, over a scripted service. */
function surfaces() {
	const goalKpiService = {
		findAll: jest.fn().mockResolvedValue({ items: ROWS, total: ROWS.length }),
		findOneByIdString: jest.fn().mockResolvedValue(ROWS[0]),
		countBy: jest.fn().mockResolvedValue(ROWS.length),
		create: jest.fn().mockResolvedValue(ROWS[0]),
		delete: jest.fn().mockResolvedValue({ affected: 1 }),
		softRemove: jest.fn().mockResolvedValue({ ...ROWS[0], deletedAt: new Date('2026-04-01T10:00:00.000Z') }),
		softRecover: jest.fn().mockResolvedValue(ROWS[0])
	};

	return { goalKpiService, resolver: new GoalKpiResolver(goalKpiService as never) };
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

/** The handlers of one controller, inherited ones included. */
function handlersOf(controller: typeof GoalKpiController): Record<string, object> {
	return controller.prototype as unknown as Record<string, object>;
}

/**
 * The permission one route runs under: what its handler states, else what its controller states.
 *
 * This is the rule the guards themselves apply — the reflector's `getAllAndOverride` over
 * `[handler, class]` — restated here, so the resolver is held to the controller's own metadata rather
 * than to a second copy of the same list written out in this file.
 */
function permissionOfRoute(controller: typeof GoalKpiController, handler: string): unknown {
	return (
		Reflect.getMetadata(PERMISSIONS_METADATA, handlersOf(controller)[handler]) ??
		Reflect.getMetadata(PERMISSIONS_METADATA, controller)
	);
}

/**
 * The guards one route actually runs under: the controller's chain followed by whatever the handler
 * states of its own, which is the order the guard context creator concatenates them in.
 */
function guardsOfRoute(controller: typeof GoalKpiController, handler: string): unknown[] {
	const declared = Reflect.getMetadata('__guards__', controller) ?? [];
	const restated = Reflect.getMetadata('__guards__', handlersOf(controller)[handler]) ?? [];

	return Array.from(new Set([...declared, ...restated]));
}

/** The permission one resolver field runs under. */
function permissionOfField(field: string): unknown {
	const fields = GoalKpiResolver.prototype as unknown as Record<string, object>;

	return Reflect.getMetadata(PERMISSIONS_METADATA, fields[field]);
}

/** Every route this domain mirrors, paired with the root field that mirrors it. */
const ROUTES: Array<[string, string]> = [
	['goalKpis', 'findAll'],
	['goalKpi', 'findById'],
	['goalKpiCount', 'getCount'],
	['createGoalKpi', 'create'],
	['updateGoalKpi', 'update'],
	['deleteGoalKpi', 'delete'],
	['softDeleteGoalKpi', 'softRemove'],
	['recoverGoalKpi', 'softRecover']
];

describe('GoalKpiResolver — the SDL declares the capabilities the REST routes serve', () => {
	it('declares the connection query, the node query and the count', () => {
		expect(rootFields('Query')).toEqual(expect.arrayContaining(['goalKpis', 'goalKpi', 'goalKpiCount']));
	});

	it('declares one mutation per delivered write route', () => {
		expect(rootFields('Mutation')).toEqual(
			expect.arrayContaining([
				'createGoalKpi',
				'updateGoalKpi',
				'deleteGoalKpi',
				'softDeleteGoalKpi',
				'recoverGoalKpi'
			])
		);
	});

	it('declares the reads and the writes the controller serves, and no more', () => {
		// The controller serves its list twice — `GET /` and the inherited `GET /pagination` — and the two
		// answer one question, so the surface states it once.
		expect(declaredRootFields('goal-kpi.api.gql', 'Query')).toEqual(['goalKpis', 'goalKpi', 'goalKpiCount']);
		expect(declaredRootFields('goal-kpi.api.gql', 'Mutation')).toEqual([
			'createGoalKpi',
			'updateGoalKpi',
			'deleteGoalKpi',
			'softDeleteGoalKpi',
			'recoverGoalKpi'
		]);
	});

	it('declares the connection, its edges, its filters and its sorts', () => {
		expect(printed).toMatch(
			/type GoalKPIConnection \{\s*nodes: \[GoalKPI!\]!\s*edges: \[GoalKPIEdge!\]!\s*totalCount: Int!\s*pageInfo: PageInfo!\s*\}/
		);
		expect(printed).toMatch(/type GoalKPIEdge \{\s*node: GoalKPI!\s*cursor: String!\s*\}/);
		expect(printed).toMatch(/input GoalKPIFilter \{/);
		expect(printed).toMatch(/input GoalKPISort \{/);
		expect(printed).toMatch(
			/enum GoalKPISortField \{\s*createdAt\s*updatedAt\s*name\s*type\s*currentValue\s*targetValue\s*\}/
		);
	});

	it('carries the reading and the target as whole numbers, and the relations as identifiers', () => {
		const body = typeBody('GoalKPI');

		expect(body).toMatch(/currentValue: Int!/);
		expect(body).toMatch(/targetValue: Int!/);
		// The list read joins the lead; the other eight routes do not, so the identifier is carried.
		expect(body).toMatch(/leadId: ID/);
		expect(body).not.toMatch(/\n\tlead:/);
		expect(body).toMatch(/deletedAt: DateTime/);
	});

	it('offers no argument it cannot honour', () => {
		expect(printed).toMatch(/goalKpis\([^)]*withDeleted/);
		expect(printed).not.toMatch(/goalKpiCount\(/);
	});
});

describe('GoalKpiResolver — the connection contract', () => {
	it('reads the list the way the delivered route reads it, and answers nodes, edges and a total', async () => {
		const { resolver, goalKpiService } = surfaces();

		const connection = await resolver.goalKpis(undefined, undefined, undefined, 20);

		// The route's own criterion and the one relation it names beside it.
		expect(goalKpiService.findAll).toHaveBeenCalledWith({ where: {}, relations: ['lead'] });
		expect(connection.nodes).toHaveLength(2);
		expect(connection.totalCount).toBe(2);
		expect(connection.pageInfo.startCursor).toBe(connection.edges[0].cursor);
		expect(connection.pageInfo.endCursor).toBe(connection.edges[1].cursor);
		expect(CursorCodec.decode(connection.edges[0].cursor).id).toBe(SIGNUPS);
	});

	it('answers newest first when the caller states no order', async () => {
		const { resolver } = surfaces();

		const connection = await resolver.goalKpis();

		expect(connection.nodes.map((node) => node.id)).toEqual([SIGNUPS, REVENUE]);
	});

	it('narrows by the fields the filter declares', async () => {
		const { resolver } = surfaces();

		expect((await resolver.goalKpis({ type: { eq: 'PERCENTAGE' } })).nodes.map((node) => node.id)).toEqual([
			REVENUE
		]);
		expect((await resolver.goalKpis({ currentValue: { gte: 1050 } })).nodes.map((node) => node.id)).toEqual([
			SIGNUPS
		]);
		expect((await resolver.goalKpis({ name: { ilike: 'net%' } })).nodes.map((node) => node.id)).toEqual([
			REVENUE
		]);
		expect((await resolver.goalKpis({ leadId: { isNull: true } })).totalCount).toBe(2);
	});

	it('orders by the keys the sort enum offers', async () => {
		const { resolver } = surfaces();

		expect(
			(await resolver.goalKpis(undefined, [{ field: 'name', direction: 'ASC' }])).nodes.map((node) => node.id)
		).toEqual([REVENUE, SIGNUPS]);
		expect(
			(await resolver.goalKpis(undefined, [{ field: 'targetValue', direction: 'DESC' }])).nodes.map(
				(node) => node.id
			)
		).toEqual([SIGNUPS, REVENUE]);
	});

	it('resumes a walk from an opaque cursor, forwards and backwards', async () => {
		const { resolver } = surfaces();
		const all = await resolver.goalKpis(undefined, undefined, undefined, 20);

		const forward = await resolver.goalKpis(undefined, undefined, {
			first: 1,
			after: all.edges[0].cursor
		});
		expect(forward.nodes.map((node) => node.id)).toEqual([REVENUE]);

		const backward = await resolver.goalKpis(undefined, undefined, {
			last: 1,
			before: all.edges[1].cursor
		});
		expect(backward.nodes.map((node) => node.id)).toEqual([SIGNUPS]);
	});

	it('refuses a sort field the resource does not declare, with the query protocol’s own code', async () => {
		const { resolver } = surfaces();

		const error = await resolver
			.goalKpis(undefined, [{ field: 'lead', direction: 'ASC' }] as never)
			.catch((thrown) => thrown);

		expect(isRefusal(error)).toBe(true);
		expect((error as Error).message).toContain('QUERY_SORT_NOT_ALLOWED');
	});

	it('refuses a filter field the resource does not declare', async () => {
		const { resolver } = surfaces();

		const error = await resolver.goalKpis({ lead: { eq: SIGNUPS } }).catch((thrown) => thrown);

		expect(isRefusal(error)).toBe(true);
		expect((error as Error).message).toContain('QUERY_UNKNOWN_FILTER_FIELD');
	});

	it('refuses both pagination styles at once rather than silently preferring one', async () => {
		const { resolver } = surfaces();

		const error = await resolver
			.goalKpis(undefined, undefined, undefined, 5, undefined, undefined, undefined, 5)
			.catch((thrown) => thrown);

		expect(isRefusal(error)).toBe(true);
		expect((error as Error).message).toContain('QUERY_NESTING_LIMIT_EXCEEDED');
	});
});

describe('GoalKpiResolver — one concept, two protocols, the same operations', () => {
	it('reads one measure through the same service method the REST route calls', async () => {
		const { resolver, goalKpiService } = surfaces();

		expect(await resolver.goalKpi(SIGNUPS)).toBe(ROWS[0]);
		expect(goalKpiService.findOneByIdString).toHaveBeenCalledWith(SIGNUPS);
	});

	it('answers null for a measure that is not there, which is the REST route’s 404 here', async () => {
		const { resolver, goalKpiService } = surfaces();
		goalKpiService.findOneByIdString.mockRejectedValueOnce(new NotFoundException());

		expect(await resolver.goalKpi(REVENUE)).toBeNull();
	});

	it('counts through the same service method the count route calls, with the route’s own options', async () => {
		const { resolver, goalKpiService } = surfaces();

		expect(await resolver.goalKpiCount()).toBe(2);
		expect(goalKpiService.countBy).toHaveBeenCalledWith();
	});

	it('files a measure through the same service method the REST route calls', async () => {
		const { resolver, goalKpiService } = surfaces();

		await resolver.createGoalKpi({
			name: 'Weekly sign-ups',
			type: 'NUMERICAL',
			operator: '>=',
			currentValue: 1200,
			targetValue: 2000,
			organizationId: ORGANIZATION
		});

		expect(goalKpiService.create).toHaveBeenCalledWith({
			name: 'Weekly sign-ups',
			type: 'NUMERICAL',
			operator: '>=',
			currentValue: 1200,
			targetValue: 2000,
			organizationId: ORGANIZATION
		});
	});

	it('changes a measure through the route’s update-through-create, identifier included', async () => {
		const { resolver, goalKpiService } = surfaces();

		await resolver.updateGoalKpi({ id: SIGNUPS, targetValue: 2500 });

		expect(goalKpiService.create).toHaveBeenCalledWith({ targetValue: 2500, id: SIGNUPS });
	});

	it('removes a measure through the same service method the REST route calls', async () => {
		const { resolver, goalKpiService } = surfaces();

		expect(await resolver.deleteGoalKpi(SIGNUPS)).toBe(true);
		expect(goalKpiService.delete).toHaveBeenCalledWith(SIGNUPS);
	});

	it('withdraws and restores a measure through the same service methods the REST routes call', async () => {
		const { resolver, goalKpiService } = surfaces();

		const withdrawn = await resolver.softDeleteGoalKpi(SIGNUPS);
		expect(withdrawn.deletedAt).toBeInstanceOf(Date);
		expect(goalKpiService.softRemove).toHaveBeenCalledWith(SIGNUPS);

		expect(await resolver.recoverGoalKpi(SIGNUPS)).toBe(ROWS[0]);
		expect(goalKpiService.softRecover).toHaveBeenCalledWith(SIGNUPS);
	});

	it('surfaces a refusal as a 4xx that is not a 404', async () => {
		const { resolver, goalKpiService } = surfaces();
		const refusal = new Error('FORBIDDEN: the record belongs to another tenant');

		goalKpiService.create.mockRejectedValueOnce(refusal);

		await expect(resolver.updateGoalKpi({ id: SIGNUPS, targetValue: 1 })).rejects.toBe(refusal);
	});
});

describe('GoalKpiResolver — the guard stack and the permission are the controller’s', () => {
	it('guards the resolver the way the controller is guarded, and not more widely', () => {
		expect(Reflect.getMetadata('__guards__', GoalKpiController)).toEqual([TenantPermissionGuard]);
		expect(Reflect.getMetadata('__guards__', GoalKpiResolver)).toEqual([TenantPermissionGuard, FeatureFlagGuard]);
	});

	it('runs every route under the guard chain the resolver states', () => {
		const stated = Reflect.getMetadata('__guards__', GoalKpiResolver) ?? [];
		const routes = [
			'findAll',
			'findById',
			'getCount',
			'pagination',
			'create',
			'update',
			'delete',
			'softRemove',
			'softRecover'
		];

		for (const handler of routes) {
			expect([...guardsOfRoute(GoalKpiController, handler), FeatureFlagGuard].sort()).toEqual([...stated].sort());
		}
	});

	it('states no permission on the class, because the controller states none', () => {
		expect(Reflect.getMetadata(PERMISSIONS_METADATA, GoalKpiController)).toBeUndefined();
		expect(Reflect.getMetadata(PERMISSIONS_METADATA, GoalKpiResolver)).toBeUndefined();
	});

	it('states on every field the permission its own route runs under, which is none', () => {
		const stated = Object.fromEntries(ROUTES.map(([field]) => [field, permissionOfField(field)]));
		const expected = Object.fromEntries(
			ROUTES.map(([field, handler]) => [field, permissionOfRoute(GoalKpiController, handler)])
		);

		expect(stated).toEqual(expected);
		expect(Object.values(stated).every((value) => value === undefined)).toBe(true);
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
		getHandler: () => (GoalKpiResolver.prototype as never)[field],
		getClass: () => GoalKpiResolver,
		getType: () => 'graphql',
		getArgByIndex: () => ({ fieldName: field })
	} as unknown as ExecutionContext;
}

describe('GoalKpiResolver — a capability that is switched off is not served', () => {
	it('declares the capability the commerce catalogue declares for this surface, on the class', () => {
		expect(Reflect.getMetadata(FEATURE_METADATA, GoalKpiResolver)).toBe(FEATURE_GRAPHQL);
		expect(Reflect.getMetadata('__guards__', GoalKpiResolver)).toContain(FeatureFlagGuard);
	});

	it('refuses a field whose capability is switched off, and names the field it refused', async () => {
		const { guard, featureService } = gate(false);

		const refusal = await guard.canActivate(graphqlContext('goalKpis')).catch((thrown) => thrown);

		expect(featureService.isFeatureEnabled).toHaveBeenCalledWith(FEATURE_GRAPHQL);
		expect(refusal).toBeInstanceOf(NotFoundException);
		expect((refusal as Error).message).toContain('goalKpis');
		expect((refusal as NotFoundException).getStatus()).toBe(404);
	});

	it('serves the field once the capability is switched on', async () => {
		const { guard } = gate(true);

		await expect(guard.canActivate(graphqlContext('goalKpis'))).resolves.toBe(true);
	});
});
