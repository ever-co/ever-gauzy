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
import { GoalTemplateController } from './goal-template.controller';
import { GoalTemplateResolver } from './goal-template.resolver';

/**
 * The catalogue an objective is authored from, over GraphQL.
 *
 * The delivered `/api/goal-templates` controller declares two routes and inherits seven, and this
 * suite pins all nine as root fields of the one composed schema: the list as a connection behind the
 * platform's own cursor codec, every field reaching the same service method its route reaches — with
 * the edit reading the row back, because the inherited route answers the store's update result rather
 * than a row — the guard chain and the permission read from the controller's own metadata, and the
 * gate answering a switched-off capability the way a missing field is answered.
 */

const TENANT = '00000000-0000-4000-8000-000000000001';
const ORGANIZATION = '00000000-0000-4000-8000-000000000002';
const COMPANY = '00000000-0000-4000-8000-000000000040';
const TEAM = '00000000-0000-4000-8000-000000000041';

/** The rows a scripted service answers with, in the order the delivered list read returns them. */
const ROWS = [
	{
		id: COMPANY,
		tenantId: TENANT,
		organizationId: ORGANIZATION,
		name: 'Company-wide objective',
		level: 'ORGANIZATION',
		category: 'GROWTH',
		createdAt: new Date('2026-03-01T10:00:00.000Z'),
		updatedAt: new Date('2026-03-01T10:00:00.000Z')
	},
	{
		id: TEAM,
		tenantId: TENANT,
		organizationId: ORGANIZATION,
		name: 'Team objective',
		level: 'TEAM',
		category: 'QUALITY',
		createdAt: new Date('2026-02-01T10:00:00.000Z'),
		updatedAt: new Date('2026-02-01T10:00:00.000Z')
	}
];

/** The resolver, over a scripted service. */
function surfaces() {
	const goalTemplateService = {
		findAll: jest.fn().mockResolvedValue({ items: ROWS, total: ROWS.length }),
		findOneByIdString: jest.fn().mockResolvedValue(ROWS[0]),
		countBy: jest.fn().mockResolvedValue(ROWS.length),
		create: jest.fn().mockResolvedValue(ROWS[0]),
		update: jest.fn().mockResolvedValue({ affected: 1 }),
		delete: jest.fn().mockResolvedValue({ affected: 1 }),
		softRemove: jest.fn().mockResolvedValue({ ...ROWS[0], deletedAt: new Date('2026-04-01T10:00:00.000Z') }),
		softRecover: jest.fn().mockResolvedValue(ROWS[0])
	};

	return { goalTemplateService, resolver: new GoalTemplateResolver(goalTemplateService as never) };
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
function permissionOfRoute(controller: typeof GoalTemplateController, handler: string): unknown {
	const handlers = controller.prototype as unknown as Record<string, object>;

	return (
		Reflect.getMetadata(PERMISSIONS_METADATA, handlers[handler]) ??
		Reflect.getMetadata(PERMISSIONS_METADATA, controller)
	);
}

/** The guards one route actually runs under: the controller's chain, then whatever the handler states. */
function guardsOfRoute(controller: typeof GoalTemplateController, handler: string): unknown[] {
	const handlers = controller.prototype as unknown as Record<string, object>;
	const declared = Reflect.getMetadata('__guards__', controller) ?? [];
	const restated = Reflect.getMetadata('__guards__', handlers[handler]) ?? [];

	return Array.from(new Set([...declared, ...restated]));
}

/** The permission one resolver field runs under. */
function permissionOfField(field: string): unknown {
	const fields = GoalTemplateResolver.prototype as unknown as Record<string, object>;

	return Reflect.getMetadata(PERMISSIONS_METADATA, fields[field]);
}

/** Every route this domain mirrors, paired with the root field that mirrors it. */
const ROUTES: Array<[string, string]> = [
	['goalTemplates', 'findAll'],
	['goalTemplate', 'findById'],
	['goalTemplateCount', 'getCount'],
	['createGoalTemplate', 'create'],
	['updateGoalTemplate', 'update'],
	['deleteGoalTemplate', 'delete'],
	['softDeleteGoalTemplate', 'softRemove'],
	['recoverGoalTemplate', 'softRecover']
];

describe('GoalTemplateResolver — the SDL declares the capabilities the REST routes serve', () => {
	it('declares the connection query, the node query and the count', () => {
		expect(rootFields('Query')).toEqual(
			expect.arrayContaining(['goalTemplates', 'goalTemplate', 'goalTemplateCount'])
		);
	});

	it('declares one mutation per delivered write route', () => {
		expect(rootFields('Mutation')).toEqual(
			expect.arrayContaining([
				'createGoalTemplate',
				'updateGoalTemplate',
				'deleteGoalTemplate',
				'softDeleteGoalTemplate',
				'recoverGoalTemplate'
			])
		);
	});

	it('declares the reads and the writes the controller serves, and no more', () => {
		expect(declaredRootFields('goal-template.api.gql', 'Query')).toEqual([
			'goalTemplates',
			'goalTemplate',
			'goalTemplateCount'
		]);
		expect(declaredRootFields('goal-template.api.gql', 'Mutation')).toEqual([
			'createGoalTemplate',
			'updateGoalTemplate',
			'deleteGoalTemplate',
			'softDeleteGoalTemplate',
			'recoverGoalTemplate'
		]);
	});

	it('declares the connection, its edges, its filters and its sorts', () => {
		expect(printed).toMatch(
			/type GoalTemplateConnection \{\s*nodes: \[GoalTemplate!\]!\s*edges: \[GoalTemplateEdge!\]!\s*totalCount: Int!\s*pageInfo: PageInfo!\s*\}/
		);
		expect(printed).toMatch(/type GoalTemplateEdge \{\s*node: GoalTemplate!\s*cursor: String!\s*\}/);
		expect(printed).toMatch(/input GoalTemplateFilter \{/);
		expect(printed).toMatch(/input GoalTemplateSort \{/);
		expect(printed).toMatch(/enum GoalTemplateSortField \{\s*createdAt\s*updatedAt\s*name\s*level\s*category\s*\}/);
	});

	it('carries the columns the delivered read answers, and not the collection it joins', () => {
		const body = typeBody('GoalTemplate');

		expect(body).toMatch(/name: String!/);
		expect(body).toMatch(/level: String!/);
		expect(body).toMatch(/category: String!/);
		// The list read loads the entry's key-result templates; the other eight routes join neither them
		// nor their KPI, and a collection is not a column the connection's filter could narrow by.
		expect(body).not.toContain('keyResults');
		expect(body).toMatch(/deletedAt: DateTime/);
	});

	it('offers no argument it cannot honour', () => {
		expect(printed).not.toMatch(/goalTemplates\([^)]*withDeleted/);
		expect(printed).not.toMatch(/goalTemplateCount\(/);
	});
});

describe('GoalTemplateResolver — the connection contract', () => {
	it('reads the list the way the delivered route reads it, and answers nodes, edges and a total', async () => {
		const { resolver, goalTemplateService } = surfaces();

		const connection = await resolver.goalTemplates(undefined, undefined, undefined, 20);

		// The route's own criterion and the two relations it names beside it.
		expect(goalTemplateService.findAll).toHaveBeenCalledWith({
			where: {},
			relations: ['keyResults', 'keyResults.kpi']
		});
		expect(connection.nodes).toHaveLength(2);
		expect(connection.totalCount).toBe(2);
		expect(connection.pageInfo.startCursor).toBe(connection.edges[0].cursor);
		expect(connection.pageInfo.endCursor).toBe(connection.edges[1].cursor);
		expect(CursorCodec.decode(connection.edges[0].cursor).id).toBe(COMPANY);
	});

	it('answers newest first when the caller states no order', async () => {
		const { resolver } = surfaces();

		expect((await resolver.goalTemplates()).nodes.map((node) => node.id)).toEqual([COMPANY, TEAM]);
	});

	it('narrows by the fields the filter declares', async () => {
		const { resolver } = surfaces();

		expect((await resolver.goalTemplates({ level: { eq: 'TEAM' } })).nodes.map((node) => node.id)).toEqual([TEAM]);
		expect((await resolver.goalTemplates({ category: { in: ['GROWTH', 'QUALITY'] } })).totalCount).toBe(2);
		expect((await resolver.goalTemplates({ name: { ilike: 'company%' } })).nodes.map((node) => node.id)).toEqual([
			COMPANY
		]);
	});

	it('orders by the keys the sort enum offers', async () => {
		const { resolver } = surfaces();

		expect(
			(await resolver.goalTemplates(undefined, [{ field: 'category', direction: 'ASC' }])).nodes.map(
				(node) => node.id
			)
		).toEqual([COMPANY, TEAM]);
	});

	it('resumes a walk from an opaque cursor, forwards and backwards', async () => {
		const { resolver } = surfaces();
		const all = await resolver.goalTemplates(undefined, undefined, undefined, 20);

		expect(
			(await resolver.goalTemplates(undefined, undefined, { first: 1, after: all.edges[0].cursor })).nodes.map(
				(node) => node.id
			)
		).toEqual([TEAM]);
		expect(
			(await resolver.goalTemplates(undefined, undefined, { last: 1, before: all.edges[1].cursor })).nodes.map(
				(node) => node.id
			)
		).toEqual([COMPANY]);
	});

	it('refuses a sort field the resource does not declare, with the query protocol’s own code', async () => {
		const { resolver } = surfaces();

		const error = await resolver
			.goalTemplates(undefined, [{ field: 'keyResults', direction: 'ASC' }] as never)
			.catch((thrown) => thrown);

		expect(isRefusal(error)).toBe(true);
		expect((error as Error).message).toContain('QUERY_SORT_NOT_ALLOWED');
	});

	it('refuses a filter field the resource does not declare', async () => {
		const { resolver } = surfaces();

		const error = await resolver.goalTemplates({ keyResults: { eq: COMPANY } }).catch((thrown) => thrown);

		expect(isRefusal(error)).toBe(true);
		expect((error as Error).message).toContain('QUERY_UNKNOWN_FILTER_FIELD');
	});

	it('refuses both pagination styles at once rather than silently preferring one', async () => {
		const { resolver } = surfaces();

		const error = await resolver
			.goalTemplates(undefined, undefined, undefined, 5, undefined, undefined, undefined, 5)
			.catch((thrown) => thrown);

		expect(isRefusal(error)).toBe(true);
		expect((error as Error).message).toContain('QUERY_NESTING_LIMIT_EXCEEDED');
	});
});

describe('GoalTemplateResolver — one concept, two protocols, the same operations', () => {
	it('reads one entry through the same service method the REST route calls', async () => {
		const { resolver, goalTemplateService } = surfaces();

		expect(await resolver.goalTemplate(COMPANY)).toBe(ROWS[0]);
		expect(goalTemplateService.findOneByIdString).toHaveBeenCalledWith(COMPANY);
	});

	it('answers null for an entry that is not there, which is the REST route’s 404 here', async () => {
		const { resolver, goalTemplateService } = surfaces();
		goalTemplateService.findOneByIdString.mockRejectedValueOnce(new NotFoundException());

		expect(await resolver.goalTemplate(TEAM)).toBeNull();
	});

	it('counts through the same service method the count route calls, with the route’s own options', async () => {
		const { resolver, goalTemplateService } = surfaces();

		expect(await resolver.goalTemplateCount()).toBe(2);
		expect(goalTemplateService.countBy).toHaveBeenCalledWith();
	});

	it('files an entry through the same service method the REST route calls', async () => {
		const { resolver, goalTemplateService } = surfaces();

		await resolver.createGoalTemplate({
			name: 'Company-wide objective',
			level: 'ORGANIZATION',
			category: 'GROWTH',
			organizationId: ORGANIZATION
		});

		expect(goalTemplateService.create).toHaveBeenCalledWith({
			name: 'Company-wide objective',
			level: 'ORGANIZATION',
			category: 'GROWTH',
			organizationId: ORGANIZATION
		});
	});

	it('changes an entry through the inherited route’s update and reads the row back', async () => {
		const { resolver, goalTemplateService } = surfaces();

		const answer = await resolver.updateGoalTemplate({ id: COMPANY, category: 'RETENTION' });

		expect(goalTemplateService.update).toHaveBeenCalledWith(COMPANY, { category: 'RETENTION' });
		expect(goalTemplateService.findOneByIdString).toHaveBeenCalledWith(COMPANY);
		expect(answer).toBe(ROWS[0]);
	});

	it('refuses an edit of an entry that is not there, before it reads anything back', async () => {
		const { resolver, goalTemplateService } = surfaces();
		goalTemplateService.update.mockRejectedValueOnce(new NotFoundException());

		await expect(resolver.updateGoalTemplate({ id: TEAM, category: 'GROWTH' })).rejects.toBeInstanceOf(
			NotFoundException
		);
	});

	it('removes an entry through the same service method the REST route calls', async () => {
		const { resolver, goalTemplateService } = surfaces();

		expect(await resolver.deleteGoalTemplate(COMPANY)).toBe(true);
		expect(goalTemplateService.delete).toHaveBeenCalledWith(COMPANY);
	});

	it('withdraws and restores an entry through the same service methods the REST routes call', async () => {
		const { resolver, goalTemplateService } = surfaces();

		const withdrawn = await resolver.softDeleteGoalTemplate(COMPANY);
		expect(withdrawn.deletedAt).toBeInstanceOf(Date);
		expect(goalTemplateService.softRemove).toHaveBeenCalledWith(COMPANY);

		expect(await resolver.recoverGoalTemplate(COMPANY)).toBe(ROWS[0]);
		expect(goalTemplateService.softRecover).toHaveBeenCalledWith(COMPANY);
	});

	it('surfaces a refusal as a 4xx that is not a 404', async () => {
		const { resolver, goalTemplateService } = surfaces();
		const refusal = new Error('FORBIDDEN: the record belongs to another tenant');

		goalTemplateService.delete.mockRejectedValueOnce(refusal);

		await expect(resolver.deleteGoalTemplate(COMPANY)).rejects.toBe(refusal);
	});
});

describe('GoalTemplateResolver — the guard stack and the permission are the controller’s', () => {
	it('guards the resolver the way the controller is guarded, and not more widely', () => {
		expect(Reflect.getMetadata('__guards__', GoalTemplateController)).toEqual([TenantPermissionGuard]);
		expect(Reflect.getMetadata('__guards__', GoalTemplateResolver)).toEqual([
			TenantPermissionGuard,
			FeatureFlagGuard
		]);
	});

	it('runs every route under the guard chain the resolver states', () => {
		const stated = Reflect.getMetadata('__guards__', GoalTemplateResolver) ?? [];
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
			expect([...guardsOfRoute(GoalTemplateController, handler), FeatureFlagGuard].sort()).toEqual(
				[...stated].sort()
			);
		}
	});

	it('states no permission on the class, because the controller states none', () => {
		expect(Reflect.getMetadata(PERMISSIONS_METADATA, GoalTemplateController)).toBeUndefined();
		expect(Reflect.getMetadata(PERMISSIONS_METADATA, GoalTemplateResolver)).toBeUndefined();
	});

	it('states on every field the permission its own route runs under, which is none', () => {
		const stated = Object.fromEntries(ROUTES.map(([field]) => [field, permissionOfField(field)]));
		const expected = Object.fromEntries(
			ROUTES.map(([field, handler]) => [field, permissionOfRoute(GoalTemplateController, handler)])
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
		getHandler: () => (GoalTemplateResolver.prototype as never)[field],
		getClass: () => GoalTemplateResolver,
		getType: () => 'graphql',
		getArgByIndex: () => ({ fieldName: field })
	} as unknown as ExecutionContext;
}

describe('GoalTemplateResolver — a capability that is switched off is not served', () => {
	it('declares the capability the commerce catalogue declares for this surface, on the class', () => {
		expect(Reflect.getMetadata(FEATURE_METADATA, GoalTemplateResolver)).toBe(FEATURE_GRAPHQL);
		expect(Reflect.getMetadata('__guards__', GoalTemplateResolver)).toContain(FeatureFlagGuard);
	});

	it('refuses a field whose capability is switched off, and names the field it refused', async () => {
		const { guard, featureService } = gate(false);

		const refusal = await guard.canActivate(graphqlContext('goalTemplates')).catch((thrown) => thrown);

		expect(featureService.isFeatureEnabled).toHaveBeenCalledWith(FEATURE_GRAPHQL);
		expect(refusal).toBeInstanceOf(NotFoundException);
		expect((refusal as Error).message).toContain('goalTemplates');
		expect((refusal as NotFoundException).getStatus()).toBe(404);
	});

	it('serves the field once the capability is switched on', async () => {
		const { guard } = gate(true);

		await expect(guard.canActivate(graphqlContext('goalTemplates'))).resolves.toBe(true);
	});
});
