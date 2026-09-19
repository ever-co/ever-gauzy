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
import { GoalKpiTemplateController } from './goal-kpi-template.controller';
import { GoalKpiTemplateResolver } from './goal-kpi-template.resolver';

/**
 * The catalogue a measure is authored from, over GraphQL.
 *
 * The delivered `/api/goal-kpi-template` controller declares two routes and inherits seven, and this
 * suite pins all nine as root fields of the one composed schema: the list as a connection behind the
 * platform's own cursor codec, every field reaching the same service method its route reaches — with
 * the edit reading the row back, because the inherited route answers the store's update result rather
 * than a row — the guard chain and the permission read from the controller's own metadata, and the
 * gate answering a switched-off capability the way a missing field is answered.
 */

const TENANT = '00000000-0000-4000-8000-000000000001';
const ORGANIZATION = '00000000-0000-4000-8000-000000000002';
const SIGNUPS = '00000000-0000-4000-8000-000000000030';
const RETENTION = '00000000-0000-4000-8000-000000000031';

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
		currentValue: 0,
		targetValue: 2000,
		createdAt: new Date('2026-03-01T10:00:00.000Z'),
		updatedAt: new Date('2026-03-01T10:00:00.000Z')
	},
	{
		id: RETENTION,
		tenantId: TENANT,
		organizationId: ORGANIZATION,
		name: 'Net revenue retention',
		description: 'The bottom of the funnel',
		type: 'PERCENTAGE',
		unit: '%',
		operator: '>=',
		currentValue: null,
		targetValue: null,
		createdAt: new Date('2026-02-01T10:00:00.000Z'),
		updatedAt: new Date('2026-02-01T10:00:00.000Z')
	}
];

/** The resolver, over a scripted service. */
function surfaces() {
	const goalKpiTemplateService = {
		findAll: jest.fn().mockResolvedValue({ items: ROWS, total: ROWS.length }),
		findOneByIdString: jest.fn().mockResolvedValue(ROWS[0]),
		countBy: jest.fn().mockResolvedValue(ROWS.length),
		create: jest.fn().mockResolvedValue(ROWS[0]),
		update: jest.fn().mockResolvedValue({ affected: 1 }),
		delete: jest.fn().mockResolvedValue({ affected: 1 }),
		softRemove: jest.fn().mockResolvedValue({ ...ROWS[0], deletedAt: new Date('2026-04-01T10:00:00.000Z') }),
		softRecover: jest.fn().mockResolvedValue(ROWS[0])
	};

	return { goalKpiTemplateService, resolver: new GoalKpiTemplateResolver(goalKpiTemplateService as never) };
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
function permissionOfRoute(controller: typeof GoalKpiTemplateController, handler: string): unknown {
	const handlers = controller.prototype as unknown as Record<string, object>;

	return (
		Reflect.getMetadata(PERMISSIONS_METADATA, handlers[handler]) ??
		Reflect.getMetadata(PERMISSIONS_METADATA, controller)
	);
}

/** The guards one route actually runs under: the controller's chain, then whatever the handler states. */
function guardsOfRoute(controller: typeof GoalKpiTemplateController, handler: string): unknown[] {
	const handlers = controller.prototype as unknown as Record<string, object>;
	const declared = Reflect.getMetadata('__guards__', controller) ?? [];
	const restated = Reflect.getMetadata('__guards__', handlers[handler]) ?? [];

	return Array.from(new Set([...declared, ...restated]));
}

/** The permission one resolver field runs under. */
function permissionOfField(field: string): unknown {
	const fields = GoalKpiTemplateResolver.prototype as unknown as Record<string, object>;

	return Reflect.getMetadata(PERMISSIONS_METADATA, fields[field]);
}

/** Every route this domain mirrors, paired with the root field that mirrors it. */
const ROUTES: Array<[string, string]> = [
	['goalKpiTemplates', 'findAll'],
	['goalKpiTemplate', 'findById'],
	['goalKpiTemplateCount', 'getCount'],
	['createGoalKpiTemplate', 'create'],
	['updateGoalKpiTemplate', 'update'],
	['deleteGoalKpiTemplate', 'delete'],
	['softDeleteGoalKpiTemplate', 'softRemove'],
	['recoverGoalKpiTemplate', 'softRecover']
];

describe('GoalKpiTemplateResolver — the SDL declares the capabilities the REST routes serve', () => {
	it('declares the connection query, the node query and the count', () => {
		expect(rootFields('Query')).toEqual(
			expect.arrayContaining(['goalKpiTemplates', 'goalKpiTemplate', 'goalKpiTemplateCount'])
		);
	});

	it('declares one mutation per delivered write route', () => {
		expect(rootFields('Mutation')).toEqual(
			expect.arrayContaining([
				'createGoalKpiTemplate',
				'updateGoalKpiTemplate',
				'deleteGoalKpiTemplate',
				'softDeleteGoalKpiTemplate',
				'recoverGoalKpiTemplate'
			])
		);
	});

	it('declares the reads and the writes the controller serves, and no more', () => {
		// The controller declares two routes and inherits seven; the surface states all nine, with the
		// paginated spelling of the list folded into the connection.
		expect(declaredRootFields('goal-kpi-template.api.gql', 'Query')).toEqual([
			'goalKpiTemplates',
			'goalKpiTemplate',
			'goalKpiTemplateCount'
		]);
		expect(declaredRootFields('goal-kpi-template.api.gql', 'Mutation')).toEqual([
			'createGoalKpiTemplate',
			'updateGoalKpiTemplate',
			'deleteGoalKpiTemplate',
			'softDeleteGoalKpiTemplate',
			'recoverGoalKpiTemplate'
		]);
	});

	it('declares the connection, its edges, its filters and its sorts', () => {
		expect(printed).toMatch(
			/type GoalKPITemplateConnection \{\s*nodes: \[GoalKPITemplate!\]!\s*edges: \[GoalKPITemplateEdge!\]!\s*totalCount: Int!\s*pageInfo: PageInfo!\s*\}/
		);
		expect(printed).toMatch(/type GoalKPITemplateEdge \{\s*node: GoalKPITemplate!\s*cursor: String!\s*\}/);
		expect(printed).toMatch(/input GoalKPITemplateFilter \{/);
		expect(printed).toMatch(/input GoalKPITemplateSort \{/);
		expect(printed).toMatch(
			/enum GoalKPITemplateSortField \{\s*createdAt\s*updatedAt\s*name\s*type\s*currentValue\s*targetValue\s*\}/
		);
	});

	it('carries the two suggested readings as nullable whole numbers', () => {
		const body = typeBody('GoalKPITemplate');

		// The columns are nullable on this row where the working measure's are not, so the members are.
		expect(body).toMatch(/currentValue: Int\n/);
		expect(body).toMatch(/targetValue: Int\n/);
		expect(body).toMatch(/deletedAt: DateTime/);
	});

	it('offers no argument it cannot honour', () => {
		expect(printed).not.toMatch(/goalKpiTemplates\([^)]*withDeleted/);
		expect(printed).not.toMatch(/goalKpiTemplateCount\(/);
	});
});

describe('GoalKpiTemplateResolver — the connection contract', () => {
	it('reads the list the way the delivered route reads it, and answers nodes, edges and a total', async () => {
		const { resolver, goalKpiTemplateService } = surfaces();

		const connection = await resolver.goalKpiTemplates(undefined, undefined, undefined, 20);

		expect(goalKpiTemplateService.findAll).toHaveBeenCalledWith({ where: {} });
		expect(connection.nodes).toHaveLength(2);
		expect(connection.totalCount).toBe(2);
		expect(connection.pageInfo.startCursor).toBe(connection.edges[0].cursor);
		expect(connection.pageInfo.endCursor).toBe(connection.edges[1].cursor);
		expect(CursorCodec.decode(connection.edges[0].cursor).id).toBe(SIGNUPS);
	});

	it('answers newest first when the caller states no order', async () => {
		const { resolver } = surfaces();

		expect((await resolver.goalKpiTemplates()).nodes.map((node) => node.id)).toEqual([SIGNUPS, RETENTION]);
	});

	it('narrows by the fields the filter declares', async () => {
		const { resolver } = surfaces();

		expect(
			(await resolver.goalKpiTemplates({ type: { eq: 'PERCENTAGE' } })).nodes.map((node) => node.id)
		).toEqual([RETENTION]);
		// A row whose target was never suggested carries none, which is what `isNull` states.
		expect((await resolver.goalKpiTemplates({ targetValue: { isNull: true } })).totalCount).toBe(1);
		expect((await resolver.goalKpiTemplates({ name: { ilike: 'weekly%' } })).nodes.map((node) => node.id)).toEqual(
			[SIGNUPS]
		);
	});

	it('orders by the keys the sort enum offers', async () => {
		const { resolver } = surfaces();

		expect(
			(await resolver.goalKpiTemplates(undefined, [{ field: 'name', direction: 'ASC' }])).nodes.map(
				(node) => node.id
			)
		).toEqual([RETENTION, SIGNUPS]);
		expect(
			(await resolver.goalKpiTemplates(undefined, [{ field: 'createdAt', direction: 'ASC' }])).nodes.map(
				(node) => node.id
			)
		).toEqual([RETENTION, SIGNUPS]);
	});

	it('resumes a walk from an opaque cursor, forwards and backwards', async () => {
		const { resolver } = surfaces();
		const all = await resolver.goalKpiTemplates(undefined, undefined, undefined, 20);

		expect(
			(await resolver.goalKpiTemplates(undefined, undefined, { first: 1, after: all.edges[0].cursor })).nodes.map(
				(node) => node.id
			)
		).toEqual([RETENTION]);
		expect(
			(await resolver.goalKpiTemplates(undefined, undefined, { last: 1, before: all.edges[1].cursor })).nodes.map(
				(node) => node.id
			)
		).toEqual([SIGNUPS]);
	});

	it('refuses a sort field the resource does not declare, with the query protocol’s own code', async () => {
		const { resolver } = surfaces();

		const error = await resolver
			.goalKpiTemplates(undefined, [{ field: 'lead', direction: 'ASC' }] as never)
			.catch((thrown) => thrown);

		expect(isRefusal(error)).toBe(true);
		expect((error as Error).message).toContain('QUERY_SORT_NOT_ALLOWED');
	});

	it('refuses a filter field the resource does not declare', async () => {
		const { resolver } = surfaces();

		const error = await resolver.goalKpiTemplates({ leadId: { eq: SIGNUPS } }).catch((thrown) => thrown);

		expect(isRefusal(error)).toBe(true);
		expect((error as Error).message).toContain('QUERY_UNKNOWN_FILTER_FIELD');
	});

	it('refuses both pagination styles at once rather than silently preferring one', async () => {
		const { resolver } = surfaces();

		const error = await resolver
			.goalKpiTemplates(undefined, undefined, undefined, 5, undefined, undefined, undefined, 5)
			.catch((thrown) => thrown);

		expect(isRefusal(error)).toBe(true);
		expect((error as Error).message).toContain('QUERY_NESTING_LIMIT_EXCEEDED');
	});
});

describe('GoalKpiTemplateResolver — one concept, two protocols, the same operations', () => {
	it('reads one entry through the same service method the REST route calls', async () => {
		const { resolver, goalKpiTemplateService } = surfaces();

		expect(await resolver.goalKpiTemplate(SIGNUPS)).toBe(ROWS[0]);
		expect(goalKpiTemplateService.findOneByIdString).toHaveBeenCalledWith(SIGNUPS);
	});

	it('answers null for an entry that is not there, which is the REST route’s 404 here', async () => {
		const { resolver, goalKpiTemplateService } = surfaces();
		goalKpiTemplateService.findOneByIdString.mockRejectedValueOnce(new NotFoundException());

		expect(await resolver.goalKpiTemplate(RETENTION)).toBeNull();
	});

	it('counts through the same service method the count route calls, with the route’s own options', async () => {
		const { resolver, goalKpiTemplateService } = surfaces();

		expect(await resolver.goalKpiTemplateCount()).toBe(2);
		expect(goalKpiTemplateService.countBy).toHaveBeenCalledWith();
	});

	it('files an entry through the same service method the REST route calls', async () => {
		const { resolver, goalKpiTemplateService } = surfaces();

		await resolver.createGoalKpiTemplate({
			name: 'Weekly sign-ups',
			type: 'NUMERICAL',
			operator: '>=',
			targetValue: 2000,
			organizationId: ORGANIZATION
		});

		expect(goalKpiTemplateService.create).toHaveBeenCalledWith({
			name: 'Weekly sign-ups',
			type: 'NUMERICAL',
			operator: '>=',
			targetValue: 2000,
			organizationId: ORGANIZATION
		});
	});

	it('changes an entry through the inherited route’s update and reads the row back', async () => {
		const { resolver, goalKpiTemplateService } = surfaces();

		const answer = await resolver.updateGoalKpiTemplate({ id: SIGNUPS, targetValue: 2500 });

		// The inherited route answers the store's update result; a field that promises a row must answer
		// the row, so it is read back through the same reader the node query uses.
		expect(goalKpiTemplateService.update).toHaveBeenCalledWith(SIGNUPS, { targetValue: 2500 });
		expect(goalKpiTemplateService.findOneByIdString).toHaveBeenCalledWith(SIGNUPS);
		expect(answer).toBe(ROWS[0]);
	});

	it('refuses an edit of an entry that is not there, before it reads anything back', async () => {
		const { resolver, goalKpiTemplateService } = surfaces();
		goalKpiTemplateService.update.mockRejectedValueOnce(new NotFoundException());

		await expect(resolver.updateGoalKpiTemplate({ id: RETENTION, targetValue: 1 })).rejects.toBeInstanceOf(
			NotFoundException
		);
	});

	it('removes an entry through the same service method the REST route calls', async () => {
		const { resolver, goalKpiTemplateService } = surfaces();

		expect(await resolver.deleteGoalKpiTemplate(SIGNUPS)).toBe(true);
		expect(goalKpiTemplateService.delete).toHaveBeenCalledWith(SIGNUPS);
	});

	it('withdraws and restores an entry through the same service methods the REST routes call', async () => {
		const { resolver, goalKpiTemplateService } = surfaces();

		const withdrawn = await resolver.softDeleteGoalKpiTemplate(SIGNUPS);
		expect(withdrawn.deletedAt).toBeInstanceOf(Date);
		expect(goalKpiTemplateService.softRemove).toHaveBeenCalledWith(SIGNUPS);

		expect(await resolver.recoverGoalKpiTemplate(SIGNUPS)).toBe(ROWS[0]);
		expect(goalKpiTemplateService.softRecover).toHaveBeenCalledWith(SIGNUPS);
	});

	it('surfaces a refusal as a 4xx that is not a 404', async () => {
		const { resolver, goalKpiTemplateService } = surfaces();
		const refusal = new Error('FORBIDDEN: the record belongs to another tenant');

		goalKpiTemplateService.delete.mockRejectedValueOnce(refusal);

		await expect(resolver.deleteGoalKpiTemplate(SIGNUPS)).rejects.toBe(refusal);
	});
});

describe('GoalKpiTemplateResolver — the guard stack and the permission are the controller’s', () => {
	it('guards the resolver the way the controller is guarded, and not more widely', () => {
		expect(Reflect.getMetadata('__guards__', GoalKpiTemplateController)).toEqual([TenantPermissionGuard]);
		expect(Reflect.getMetadata('__guards__', GoalKpiTemplateResolver)).toEqual([
			TenantPermissionGuard,
			FeatureFlagGuard
		]);
	});

	it('runs every route under the guard chain the resolver states', () => {
		const stated = Reflect.getMetadata('__guards__', GoalKpiTemplateResolver) ?? [];
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
			expect([...guardsOfRoute(GoalKpiTemplateController, handler), FeatureFlagGuard].sort()).toEqual(
				[...stated].sort()
			);
		}
	});

	it('states no permission on the class, because the controller states none', () => {
		expect(Reflect.getMetadata(PERMISSIONS_METADATA, GoalKpiTemplateController)).toBeUndefined();
		expect(Reflect.getMetadata(PERMISSIONS_METADATA, GoalKpiTemplateResolver)).toBeUndefined();
	});

	it('states on every field the permission its own route runs under, which is none', () => {
		const stated = Object.fromEntries(ROUTES.map(([field]) => [field, permissionOfField(field)]));
		const expected = Object.fromEntries(
			ROUTES.map(([field, handler]) => [field, permissionOfRoute(GoalKpiTemplateController, handler)])
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
		getHandler: () => (GoalKpiTemplateResolver.prototype as never)[field],
		getClass: () => GoalKpiTemplateResolver,
		getType: () => 'graphql',
		getArgByIndex: () => ({ fieldName: field })
	} as unknown as ExecutionContext;
}

describe('GoalKpiTemplateResolver — a capability that is switched off is not served', () => {
	it('declares the capability the commerce catalogue declares for this surface, on the class', () => {
		expect(Reflect.getMetadata(FEATURE_METADATA, GoalKpiTemplateResolver)).toBe(FEATURE_GRAPHQL);
		expect(Reflect.getMetadata('__guards__', GoalKpiTemplateResolver)).toContain(FeatureFlagGuard);
	});

	it('refuses a field whose capability is switched off, and names the field it refused', async () => {
		const { guard, featureService } = gate(false);

		const refusal = await guard.canActivate(graphqlContext('goalKpiTemplates')).catch((thrown) => thrown);

		expect(featureService.isFeatureEnabled).toHaveBeenCalledWith(FEATURE_GRAPHQL);
		expect(refusal).toBeInstanceOf(NotFoundException);
		expect((refusal as Error).message).toContain('goalKpiTemplates');
		expect((refusal as NotFoundException).getStatus()).toBe(404);
	});

	it('serves the field once the capability is switched on', async () => {
		const { guard } = gate(true);

		await expect(guard.canActivate(graphqlContext('goalKpiTemplates'))).resolves.toBe(true);
	});
});
