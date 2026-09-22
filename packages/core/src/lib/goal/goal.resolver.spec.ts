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
import { GoalController } from './goal.controller';
import { GoalResolver } from './goal.resolver';

/**
 * The objective over GraphQL.
 *
 * The delivered `/api/goals` routes serve a list, a node, a count, a filing, an edit, a removal and
 * the two lifecycle moves. This suite pins the half of the two-protocol doctrine that is easy to get
 * quietly wrong:
 *
 * - every one of those capabilities is a root field of the one composed schema, and the list is a
 *   connection with the platform's own cursor codec behind it, so a cursor obtained over REST resumes
 *   here and a refusal is the query protocol's own code;
 * - every field reaches the same `GoalService` method the REST route reaches, so a client does not
 *   choose a better surface by choosing a protocol;
 * - **the guard chain is the controller's and no field states a permission**, because the controller
 *   states none on any of its nine routes — the two lists are read from the controller's own metadata
 *   and compared, field by field, rather than restated here;
 * - the connection's default order is the order the delivered list read states, rather than one
 *   invented for this surface;
 * - the gate: a tenant that switched the capability off is answered the way a missing field is.
 */

const TENANT = '00000000-0000-4000-8000-000000000001';
const ORGANIZATION = '00000000-0000-4000-8000-000000000002';
const EARLIER = '00000000-0000-4000-8000-000000000010';
const LATER = '00000000-0000-4000-8000-000000000011';

/**
 * The rows a scripted service answers with, in the order the delivered list read returns them: the
 * route states `createdAt ASC`, so the older objective comes first.
 */
const ROWS = [
	{
		id: EARLIER,
		tenantId: TENANT,
		organizationId: ORGANIZATION,
		name: 'Grow the self-serve funnel',
		description: 'The objective the quarter was planned around',
		deadline: '2026-12-31',
		level: 'ORGANIZATION',
		progress: 40,
		ownerEmployeeId: null,
		leadId: null,
		createdAt: new Date('2026-01-01T10:00:00.000Z'),
		updatedAt: new Date('2026-03-01T10:00:00.000Z')
	},
	{
		id: LATER,
		tenantId: TENANT,
		organizationId: ORGANIZATION,
		name: 'Ship the billing migration',
		description: 'The objective the platform team owns',
		deadline: '2026-09-30',
		level: 'TEAM',
		progress: 75,
		ownerEmployeeId: null,
		leadId: null,
		createdAt: new Date('2026-02-01T10:00:00.000Z'),
		updatedAt: new Date('2026-02-01T10:00:00.000Z')
	}
];

/** The resolver, over a scripted service. */
function surfaces() {
	const goalService = {
		findAll: jest.fn().mockResolvedValue({ items: ROWS, total: ROWS.length }),
		findOneByIdString: jest.fn().mockResolvedValue(ROWS[0]),
		countBy: jest.fn().mockResolvedValue(ROWS.length),
		create: jest.fn().mockResolvedValue(ROWS[0]),
		delete: jest.fn().mockResolvedValue({ affected: 1 }),
		softRemove: jest.fn().mockResolvedValue({ ...ROWS[0], deletedAt: new Date('2026-04-01T10:00:00.000Z') }),
		softRecover: jest.fn().mockResolvedValue(ROWS[0])
	};

	return { goalService, resolver: new GoalResolver(goalService as never) };
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
function handlersOf(controller: typeof GoalController): Record<string, object> {
	return controller.prototype as unknown as Record<string, object>;
}

/**
 * The permission one route runs under: what its handler states, else what its controller states.
 *
 * This is the rule the guards themselves apply — the reflector's `getAllAndOverride` over
 * `[handler, class]` — restated here, so the resolver is held to the controller's own metadata rather
 * than to a second copy of the same list written out in this file.
 */
function permissionOfRoute(controller: typeof GoalController, handler: string): unknown {
	return (
		Reflect.getMetadata(PERMISSIONS_METADATA, handlersOf(controller)[handler]) ??
		Reflect.getMetadata(PERMISSIONS_METADATA, controller)
	);
}

/**
 * The guards one route actually runs under: the controller's chain followed by whatever the handler
 * states of its own, which is the order the guard context creator concatenates them in.
 */
function guardsOfRoute(controller: typeof GoalController, handler: string): unknown[] {
	const declared = Reflect.getMetadata('__guards__', controller) ?? [];
	const restated = Reflect.getMetadata('__guards__', handlersOf(controller)[handler]) ?? [];

	return Array.from(new Set([...declared, ...restated]));
}

/** The permission one resolver field runs under. */
function permissionOfField(field: string): unknown {
	const fields = GoalResolver.prototype as unknown as Record<string, object>;

	return Reflect.getMetadata(PERMISSIONS_METADATA, fields[field]);
}

/** Every route this domain mirrors, paired with the root field that mirrors it. */
const ROUTES: Array<[string, string]> = [
	['goals', 'findAll'],
	['goal', 'findById'],
	['goalCount', 'getCount'],
	['createGoal', 'create'],
	['updateGoal', 'update'],
	['deleteGoal', 'delete'],
	['softDeleteGoal', 'softRemove'],
	['recoverGoal', 'softRecover']
];

describe('GoalResolver — the SDL declares the capabilities the REST routes serve', () => {
	it('declares the connection query, the node query and the count', () => {
		expect(rootFields('Query')).toEqual(expect.arrayContaining(['goals', 'goal', 'goalCount']));
	});

	it('declares one mutation per delivered write route', () => {
		expect(rootFields('Mutation')).toEqual(
			expect.arrayContaining([
				'createGoal',
				'updateGoal',
				'deleteGoal',
				'softDeleteGoal',
				'recoverGoal'
			])
		);
	});

	it('declares the reads and the writes the controller serves, and no more', () => {
		// The controller serves its list twice — `GET /` and the inherited `GET /pagination` — and the
		// two answer one question, so the surface states it once: a second root field for the paginated
		// spelling would be a second surface that could disagree with this one. The document this
		// resolver owns is what is pinned here, so a field it grew that no route justifies is caught
		// even before the composition check would refuse it.
		expect(declaredRootFields('goal.api.gql', 'Query')).toEqual(['goals', 'goal', 'goalCount']);
		expect(declaredRootFields('goal.api.gql', 'Mutation')).toEqual([
			'createGoal',
			'updateGoal',
			'deleteGoal',
			'softDeleteGoal',
			'recoverGoal'
		]);
	});

	it('declares the connection, its edges, its filters and its sorts', () => {
		expect(printed).toMatch(
			/type GoalConnection \{\s*nodes: \[Goal!\]!\s*edges: \[GoalEdge!\]!\s*totalCount: Int!\s*pageInfo: PageInfo!\s*\}/
		);
		expect(printed).toMatch(/type GoalEdge \{\s*node: Goal!\s*cursor: String!\s*\}/);
		expect(printed).toMatch(/input GoalFilter \{/);
		expect(printed).toMatch(/input GoalSort \{/);
		expect(printed).toMatch(/enum GoalSortField \{\s*createdAt\s*updatedAt\s*name\s*level\s*progress\s*\}/);
	});

	it('carries the columns the delivered read answers, and the relations as identifiers', () => {
		const body = typeBody('Goal');

		expect(body).toMatch(/name: String!/);
		expect(body).toMatch(/level: String!/);
		// The progress roll-up is a whole number of percent in the column, so the member is an `Int`.
		expect(body).toMatch(/progress: Int!/);
		// The relation columns travel on the row itself, so the identifiers always have a value.
		expect(body).toMatch(/ownerTeamId: ID/);
		expect(body).toMatch(/ownerEmployeeId: ID/);
		expect(body).toMatch(/leadId: ID/);
		expect(body).toMatch(/alignedKeyResultId: ID/);
		// The relations themselves are loaded only when a REST caller names them in `relations`, which
		// this surface's read does not: the key results of an objective are `KeyResult.goalId`.
		expect(body).not.toContain('keyResults');
		expect(body).not.toMatch(/\n\townerTeam:/);
		// Withdrawing and restoring are delivered routes whose whole effect is this column, so it is
		// carried: without it the answer to the write that withdrew a row would not say so.
		expect(body).toMatch(/deletedAt: DateTime/);
	});

	it('offers no argument it cannot honour', () => {
		// The delivered list read reads live rows only, so the connection does not offer `withDeleted`.
		expect(printed).toMatch(/goals\([^)]*withDeleted/);
		// The count route passes its query string through as the store's own `where`, which this surface
		// cannot hand to that call, so the count states no filter it could not honour.
		expect(printed).not.toMatch(/goalCount\(/);
	});
});

describe('GoalResolver — the connection contract', () => {
	it('reads the list the way the delivered route reads it, and answers nodes, edges and a total', async () => {
		const { resolver, goalService } = surfaces();

		const connection = await resolver.goals(undefined, undefined, undefined, 20);

		// The route's own defaults for an unstated request: no criterion, no relation, and the order the
		// route states.
		expect(goalService.findAll).toHaveBeenCalledWith({ where: {}, order: { createdAt: 'ASC' } });
		expect(connection.nodes).toHaveLength(2);
		expect(connection.totalCount).toBe(2);
		expect(connection.pageInfo.startCursor).toBe(connection.edges[0].cursor);
		expect(connection.pageInfo.endCursor).toBe(connection.edges[1].cursor);
		expect(connection.pageInfo.hasNextPage).toBe(false);
		// The cursor is the platform's own codec, so the same cursor is valid on the REST surface.
		expect(CursorCodec.decode(connection.edges[0].cursor).id).toBe(EARLIER);
	});

	it('answers in the order the delivered route states when the caller states none', async () => {
		const { resolver } = surfaces();

		// The delivered read is handed `createdAt ASC`, and the service answers in that order.
		const connection = await resolver.goals();

		expect(connection.nodes.map((node) => node.id)).toEqual([EARLIER, LATER]);
	});

	it('narrows by the fields the filter declares', async () => {
		const { resolver } = surfaces();

		const byLevel = await resolver.goals({ level: { eq: 'TEAM' } });
		expect(byLevel.nodes.map((node) => node.id)).toEqual([LATER]);

		const byProgress = await resolver.goals({ progress: { gte: 50 } });
		expect(byProgress.nodes.map((node) => node.id)).toEqual([LATER]);

		const byName = await resolver.goals({ name: { ilike: 'grow%' } });
		expect(byName.nodes.map((node) => node.id)).toEqual([EARLIER]);

		// The relation columns are filterable because they travel on the row.
		const byOwner = await resolver.goals({ ownerEmployeeId: { isNull: true } });
		expect(byOwner.totalCount).toBe(2);
	});

	it('orders by the keys the sort enum offers', async () => {
		const { resolver } = surfaces();

		const byName = await resolver.goals(undefined, [{ field: 'name', direction: 'ASC' }]);
		expect(byName.nodes.map((node) => node.id)).toEqual([EARLIER, LATER]);

		const byProgress = await resolver.goals(undefined, [{ field: 'progress', direction: 'DESC' }]);
		expect(byProgress.nodes.map((node) => node.id)).toEqual([LATER, EARLIER]);
	});

	it('resumes a walk from an opaque cursor', async () => {
		const { resolver } = surfaces();
		const first = await resolver.goals(undefined, undefined, undefined, 1);

		expect(first.nodes.map((node) => node.id)).toEqual([EARLIER]);

		const second = await resolver.goals(undefined, undefined, {
			first: 1,
			after: first.pageInfo.endCursor ?? undefined
		});

		expect(second.nodes.map((node) => node.id)).toEqual([LATER]);
		expect(second.pageInfo.hasPreviousPage).toBe(true);
	});

	it('refuses a sort field the resource does not declare, with the query protocol’s own code', async () => {
		const { resolver } = surfaces();

		const error = await resolver
			.goals(undefined, [{ field: 'ownerTeam', direction: 'ASC' }] as never)
			.catch((thrown) => thrown);

		expect(isRefusal(error)).toBe(true);
		expect((error as Error).message).toContain('QUERY_SORT_NOT_ALLOWED');
	});

	it('refuses a filter field the resource does not declare', async () => {
		const { resolver } = surfaces();

		const error = await resolver.goals({ keyResults: { eq: EARLIER } }).catch((thrown) => thrown);

		expect(isRefusal(error)).toBe(true);
		expect((error as Error).message).toContain('QUERY_UNKNOWN_FILTER_FIELD');
	});

	it('refuses both pagination styles at once rather than silently preferring one', async () => {
		const { resolver } = surfaces();

		const error = await resolver
			.goals(undefined, undefined, undefined, 5, undefined, undefined, undefined, 5)
			.catch((thrown) => thrown);

		expect(isRefusal(error)).toBe(true);
		expect((error as Error).message).toContain('QUERY_NESTING_LIMIT_EXCEEDED');
	});
});

describe('GoalResolver — one concept, two protocols, the same operations', () => {
	it('reads one objective through the same service method the REST route calls', async () => {
		const { resolver, goalService } = surfaces();

		expect(await resolver.goal(EARLIER)).toBe(ROWS[0]);
		expect(goalService.findOneByIdString).toHaveBeenCalledWith(EARLIER);
	});

	it('answers null for an objective that is not there, which is the REST route’s 404 here', async () => {
		const { resolver, goalService } = surfaces();
		goalService.findOneByIdString.mockRejectedValueOnce(new NotFoundException());

		expect(await resolver.goal(LATER)).toBeNull();
	});

	it('counts through the same service method the count route calls, with the route’s own options', async () => {
		const { resolver, goalService } = surfaces();

		expect(await resolver.goalCount()).toBe(2);
		expect(goalService.countBy).toHaveBeenCalledWith();
	});

	it('files an objective through the same service method the REST route calls', async () => {
		const { resolver, goalService } = surfaces();

		await resolver.createGoal({ name: 'Grow the self-serve funnel', organizationId: ORGANIZATION });

		expect(goalService.create).toHaveBeenCalledWith({
			name: 'Grow the self-serve funnel',
			organizationId: ORGANIZATION
		});
	});

	it('edits an objective through the route’s own two calls, in the route’s own order', async () => {
		const { resolver, goalService } = surfaces();

		await resolver.updateGoal({ id: EARLIER, progress: 55 });

		// The read that turns a foreign or absent identifier into a miss, then the update-through-create.
		expect(goalService.findOneByIdString).toHaveBeenCalledWith(EARLIER);
		expect(goalService.create).toHaveBeenCalledWith({ progress: 55, id: EARLIER });
	});

	it('refuses an edit of an objective that is not there, before it writes anything', async () => {
		const { resolver, goalService } = surfaces();
		goalService.findOneByIdString.mockRejectedValueOnce(new NotFoundException());

		await expect(resolver.updateGoal({ id: LATER, progress: 10 })).rejects.toBeInstanceOf(NotFoundException);
		expect(goalService.create).not.toHaveBeenCalled();
	});

	it('removes an objective through the same service method the REST route calls', async () => {
		const { resolver, goalService } = surfaces();

		expect(await resolver.deleteGoal(EARLIER)).toBe(true);
		expect(goalService.delete).toHaveBeenCalledWith(EARLIER);
	});

	it('withdraws and restores an objective through the same service methods the REST routes call', async () => {
		const { resolver, goalService } = surfaces();

		const withdrawn = await resolver.softDeleteGoal(EARLIER);
		expect(withdrawn.deletedAt).toBeInstanceOf(Date);
		expect(goalService.softRemove).toHaveBeenCalledWith(EARLIER);

		expect(await resolver.recoverGoal(EARLIER)).toBe(ROWS[0]);
		expect(goalService.softRecover).toHaveBeenCalledWith(EARLIER);
	});

	it('surfaces a refusal as a 4xx that is not a 404', async () => {
		const { resolver, goalService } = surfaces();
		const refusal = new Error('FORBIDDEN: the record belongs to another tenant');

		goalService.delete.mockRejectedValueOnce(refusal);

		await expect(resolver.deleteGoal(EARLIER)).rejects.toBe(refusal);
	});
});

describe('GoalResolver — the guard stack and the permission are the controller’s', () => {
	it('guards the resolver the way the controller is guarded, and not more widely', () => {
		const resolverGuards = Reflect.getMetadata('__guards__', GoalResolver) ?? [];
		const controllerGuards = Reflect.getMetadata('__guards__', GoalController) ?? [];

		// The controller carries the tenant guard and nothing else: the permission guard is not part of
		// its chain, so carrying it here would be a field that is narrower than every route it mirrors.
		expect(controllerGuards).toEqual([TenantPermissionGuard]);
		expect(resolverGuards).toEqual([TenantPermissionGuard, FeatureFlagGuard]);
	});

	it('runs every route under the guard chain the resolver states', () => {
		const stated = Reflect.getMetadata('__guards__', GoalResolver) ?? [];
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
			// The controller's chain plus the gate on the endpoint itself and the resolver's are the same
			// set, which is the whole parity claim: a route that carried a guard of its own would narrow
			// REST below GraphQL and is caught here.
			expect([...guardsOfRoute(GoalController, handler), FeatureFlagGuard].sort()).toEqual([...stated].sort());
		}
	});

	it('states no permission on the class, because the controller states none', () => {
		expect(Reflect.getMetadata(PERMISSIONS_METADATA, GoalController)).toBeUndefined();
		expect(Reflect.getMetadata(PERMISSIONS_METADATA, GoalResolver)).toBeUndefined();
	});

	it('states on every field the permission its own route runs under, which is none', () => {
		const stated = Object.fromEntries(ROUTES.map(([field]) => [field, permissionOfField(field)]));
		const expected = Object.fromEntries(
			ROUTES.map(([field, handler]) => [field, permissionOfRoute(GoalController, handler)])
		);

		expect(stated).toEqual(expected);
		// Stated explicitly as well, so a resolver field that grew a permission of its own is caught even
		// if the controller's metadata were to grow the same one for an unrelated reason.
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
		getHandler: () => (GoalResolver.prototype as never)[field],
		getClass: () => GoalResolver,
		getType: () => 'graphql',
		getArgByIndex: () => ({ fieldName: field })
	} as unknown as ExecutionContext;
}

describe('GoalResolver — a capability that is switched off is not served', () => {
	it('declares the capability the commerce catalogue declares for this surface, on the class', () => {
		// One statement, read by the guard with `getAllAndOverride` over the handler and then the class,
		// so every field is behind it.
		expect(Reflect.getMetadata(FEATURE_METADATA, GoalResolver)).toBe(FEATURE_GRAPHQL);
		expect(Reflect.getMetadata('__guards__', GoalResolver)).toContain(FeatureFlagGuard);
	});

	it('refuses a field whose capability is switched off, and names the field it refused', async () => {
		const { guard, featureService } = gate(false);

		const refusal = await guard.canActivate(graphqlContext('goals')).catch((thrown) => thrown);

		// The code the guard resolved is the one this resolver declared, not a second copy of it.
		expect(featureService.isFeatureEnabled).toHaveBeenCalledWith(FEATURE_GRAPHQL);
		expect(refusal).toBeInstanceOf(NotFoundException);
		// A disabled capability answers the way a missing one does, and says which field was refused.
		expect((refusal as Error).message).toContain('goals');
		expect((refusal as NotFoundException).getStatus()).toBe(404);
	});

	it('serves the field once the capability is switched on', async () => {
		const { guard } = gate(true);

		await expect(guard.canActivate(graphqlContext('goals'))).resolves.toBe(true);
	});
});
