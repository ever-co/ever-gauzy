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
import { KeyResultController } from './keyresult.controller';
import { KeyResultResolver } from './keyresult.resolver';

/**
 * The measurable half of an objective, over GraphQL.
 *
 * The delivered `/api/key-results` controller declares five routes and inherits four, and this suite
 * pins all nine as root fields of the one composed schema — the bulk write and the node read included,
 * the node read because its reader joins relations the list reader does not, and the bulk write
 * because it saves a list where the single create saves a body.
 *
 * It also pins the fact that makes the count worth a comment: a router walks a class's own methods
 * before the base class's, so the controller's single-segment `GET /:id` is registered ahead of the
 * inherited `count` and `pagination` patterns and answers them on REST. The surface states each
 * capability where the controller declares it, and the ordering that shadows them is asserted here so
 * the note cannot quietly stop being true.
 */

const TENANT = '00000000-0000-4000-8000-000000000001';
const ORGANIZATION = '00000000-0000-4000-8000-000000000002';
const GOAL = '00000000-0000-4000-8000-000000000090';
const OWNER = '00000000-0000-4000-8000-000000000091';
const SIGNUPS = '00000000-0000-4000-8000-000000000092';
const RETENTION = '00000000-0000-4000-8000-000000000093';

/** The rows a scripted service answers with, in the order the delivered list read returns them. */
const ROWS = [
	{
		id: SIGNUPS,
		tenantId: TENANT,
		organizationId: ORGANIZATION,
		name: 'Weekly sign-ups',
		description: 'The top of the funnel',
		type: 'NUMERICAL',
		targetValue: 2000,
		initialValue: 0,
		unit: 'accounts',
		update: 1500,
		progress: 75,
		deadline: 'SPECIFIC',
		status: 'ON_TRACK',
		weight: '50',
		ownerId: OWNER,
		leadId: null,
		projectId: null,
		taskId: null,
		kpiId: null,
		goalId: GOAL,
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
		targetValue: null,
		initialValue: null,
		unit: '%',
		update: 104,
		progress: 40,
		deadline: 'NONE',
		status: 'AT_RISK',
		weight: '50',
		ownerId: OWNER,
		leadId: null,
		projectId: null,
		taskId: null,
		kpiId: null,
		goalId: null,
		createdAt: new Date('2026-02-01T10:00:00.000Z'),
		updatedAt: new Date('2026-02-01T10:00:00.000Z')
	}
];

/** The resolver, over a scripted service. */
function surfaces() {
	const keyResultService = {
		findAll: jest.fn().mockResolvedValue({ items: ROWS, total: ROWS.length }),
		findOneByIdString: jest.fn().mockResolvedValue(ROWS[0]),
		countBy: jest.fn().mockResolvedValue(ROWS.length),
		create: jest.fn().mockResolvedValue(ROWS[0]),
		createBulk: jest.fn().mockResolvedValue(ROWS),
		delete: jest.fn().mockResolvedValue({ affected: 1 }),
		softRemove: jest.fn().mockResolvedValue({ ...ROWS[0], deletedAt: new Date('2026-04-01T10:00:00.000Z') }),
		softRecover: jest.fn().mockResolvedValue(ROWS[0])
	};

	return { keyResultService, resolver: new KeyResultResolver(keyResultService as never) };
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
function permissionOfRoute(controller: typeof KeyResultController, handler: string): unknown {
	const handlers = controller.prototype as unknown as Record<string, object>;

	return (
		Reflect.getMetadata(PERMISSIONS_METADATA, handlers[handler]) ??
		Reflect.getMetadata(PERMISSIONS_METADATA, controller)
	);
}

/** The guards one route actually runs under: the controller's chain, then whatever the handler states. */
function guardsOfRoute(controller: typeof KeyResultController, handler: string): unknown[] {
	const handlers = controller.prototype as unknown as Record<string, object>;
	const declared = Reflect.getMetadata('__guards__', controller) ?? [];
	const restated = Reflect.getMetadata('__guards__', handlers[handler]) ?? [];

	return Array.from(new Set([...declared, ...restated]));
}

/** The permission one resolver field runs under. */
function permissionOfField(field: string): unknown {
	const fields = KeyResultResolver.prototype as unknown as Record<string, object>;

	return Reflect.getMetadata(PERMISSIONS_METADATA, fields[field]);
}

/** Every route this domain mirrors, paired with the root field that mirrors it. */
const ROUTES: Array<[string, string]> = [
	['keyResults', 'findAll'],
	['keyResult', 'getAll'],
	['keyResultCount', 'getCount'],
	['createKeyResult', 'create'],
	['createKeyResults', 'createBulkKeyResults'],
	['updateKeyResult', 'update'],
	['deleteKeyResult', 'delete'],
	['softDeleteKeyResult', 'softRemove'],
	['recoverKeyResult', 'softRecover']
];

describe('KeyResultResolver — the SDL declares the capabilities the REST routes serve', () => {
	it('declares the connection query, the node query and the count', () => {
		expect(rootFields('Query')).toEqual(expect.arrayContaining(['keyResults', 'keyResult', 'keyResultCount']));
	});

	it('declares one mutation per delivered write route, the bulk write included', () => {
		expect(rootFields('Mutation')).toEqual(
			expect.arrayContaining([
				'createKeyResult',
				'createKeyResults',
				'updateKeyResult',
				'deleteKeyResult',
				'softDeleteKeyResult',
				'recoverKeyResult'
			])
		);
	});

	it('declares the reads and the writes the controller serves, and no more', () => {
		expect(declaredRootFields('keyresult.api.gql', 'Query')).toEqual([
			'keyResults',
			'keyResult',
			'keyResultCount'
		]);
		expect(declaredRootFields('keyresult.api.gql', 'Mutation')).toEqual([
			'createKeyResult',
			'createKeyResults',
			'updateKeyResult',
			'deleteKeyResult',
			'softDeleteKeyResult',
			'recoverKeyResult'
		]);
	});

	it('declares the connection, its edges, its filters and its sorts', () => {
		expect(printed).toMatch(
			/type KeyResultConnection \{\s*nodes: \[KeyResult!\]!\s*edges: \[KeyResultEdge!\]!\s*totalCount: Int!\s*pageInfo: PageInfo!\s*\}/
		);
		expect(printed).toMatch(/type KeyResultEdge \{\s*node: KeyResult!\s*cursor: String!\s*\}/);
		expect(printed).toMatch(/input KeyResultFilter \{/);
		expect(printed).toMatch(/input KeyResultSort \{/);
		expect(printed).toMatch(
			/enum KeyResultSortField \{\s*createdAt\s*updatedAt\s*name\s*type\s*progress\s*targetValue\s*deadline\s*status\s*\}/
		);
	});

	it('carries the numbers as numbers, and the relations the node read joins as identifiers', () => {
		const body = typeBody('KeyResult');

		expect(body).toMatch(/targetValue: Int\n/);
		expect(body).toMatch(/initialValue: Int\n/);
		expect(body).toMatch(/update: Int!/);
		expect(body).toMatch(/progress: Int!/);
		// The node read joins the goal, the lead and the owner; the list read joins none of them, so the
		// identifiers the row always holds are what is carried.
		expect(body).toMatch(/goalId: ID/);
		expect(body).toMatch(/leadId: ID/);
		expect(body).toMatch(/ownerId: ID!/);
		expect(body).not.toMatch(/\n\tgoal:/);
		expect(body).not.toMatch(/\n\towner:/);
		// The updates the node read joins are a connection of their own, narrowed by `keyResultId`.
		expect(body).not.toContain('updates');
		// `weight` is the text column it is on the delivered entity; see the note above the type.
		expect(body).toMatch(/weight: String\n/);
		expect(body).toMatch(/deadline: String!/);
		expect(body).toMatch(/deletedAt: DateTime/);
	});

	it('offers no argument it cannot honour', () => {
		expect(printed).toMatch(/keyResults\([^)]*withDeleted/);
		expect(printed).not.toMatch(/keyResultCount\(/);
	});
});

describe('KeyResultResolver — the delivered router answers two paths with the node read', () => {
	it('registers the controller’s own single-segment pattern before the routes it inherits', () => {
		const order = new MetadataScanner().getAllMethodNames(KeyResultController.prototype);

		expect(order.indexOf('getAll')).toBeGreaterThanOrEqual(0);
		expect(order.indexOf('getAll')).toBeLessThan(order.indexOf('getCount'));
		expect(order.indexOf('getAll')).toBeLessThan(order.indexOf('pagination'));
	});

	it('states the count under its own name, which is where the controller declares it', () => {
		expect(rootFields('Query')).toEqual(expect.arrayContaining(['keyResultCount']));
	});
});

describe('KeyResultResolver — the connection contract', () => {
	it('reads the list the way the inherited route reads it, and answers nodes, edges and a total', async () => {
		const { resolver, keyResultService } = surfaces();

		const connection = await resolver.keyResults(undefined, undefined, undefined, 20);

		expect(keyResultService.findAll).toHaveBeenCalledWith({});
		expect(connection.nodes).toHaveLength(2);
		expect(connection.totalCount).toBe(2);
		expect(connection.pageInfo.startCursor).toBe(connection.edges[0].cursor);
		expect(connection.pageInfo.endCursor).toBe(connection.edges[1].cursor);
		expect(CursorCodec.decode(connection.edges[0].cursor).id).toBe(SIGNUPS);
	});

	it('answers newest first when the caller states no order', async () => {
		const { resolver } = surfaces();

		expect((await resolver.keyResults()).nodes.map((node) => node.id)).toEqual([SIGNUPS, RETENTION]);
	});

	it('narrows by the fields the filter declares, an objective’s key results among them', async () => {
		const { resolver } = surfaces();

		// An objective's key results are this connection narrowed by `goalId`, and one employee's are the
		// same connection narrowed by `ownerId`.
		expect((await resolver.keyResults({ goalId: { eq: GOAL } })).nodes.map((node) => node.id)).toEqual([
			SIGNUPS
		]);
		expect((await resolver.keyResults({ ownerId: { eq: OWNER } })).totalCount).toBe(2);
		expect((await resolver.keyResults({ progress: { gt: 50 } })).nodes.map((node) => node.id)).toEqual([
			SIGNUPS
		]);
		expect((await resolver.keyResults({ status: { eq: 'AT_RISK' } })).nodes.map((node) => node.id)).toEqual([
			RETENTION
		]);
	});

	it('orders by the keys the sort enum offers', async () => {
		const { resolver } = surfaces();

		expect(
			(await resolver.keyResults(undefined, [{ field: 'name', direction: 'ASC' }])).nodes.map((node) => node.id)
		).toEqual([RETENTION, SIGNUPS]);
		// One of the two rows states no target, and an absent value is the largest one in the connection
		// contract — so it comes first under a descending order rather than last. That is the rule the
		// contract states once for every resource on this platform, not a choice made here.
		expect(
			(await resolver.keyResults(undefined, [{ field: 'targetValue', direction: 'DESC' }])).nodes.map(
				(node) => node.id
			)
		).toEqual([RETENTION, SIGNUPS]);
		expect(
			(await resolver.keyResults(undefined, [{ field: 'targetValue', direction: 'ASC' }])).nodes.map(
				(node) => node.id
			)
		).toEqual([SIGNUPS, RETENTION]);
	});

	it('resumes a walk from an opaque cursor, forwards and backwards', async () => {
		const { resolver } = surfaces();
		const all = await resolver.keyResults(undefined, undefined, undefined, 20);

		expect(
			(await resolver.keyResults(undefined, undefined, { first: 1, after: all.edges[0].cursor })).nodes.map(
				(node) => node.id
			)
		).toEqual([RETENTION]);
		expect(
			(await resolver.keyResults(undefined, undefined, { last: 1, before: all.edges[1].cursor })).nodes.map(
				(node) => node.id
			)
		).toEqual([SIGNUPS]);
	});

	it('refuses a sort field the resource does not declare, with the query protocol’s own code', async () => {
		const { resolver } = surfaces();

		const error = await resolver
			.keyResults(undefined, [{ field: 'updates', direction: 'ASC' }] as never)
			.catch((thrown) => thrown);

		expect(isRefusal(error)).toBe(true);
		expect((error as Error).message).toContain('QUERY_SORT_NOT_ALLOWED');
	});

	it('refuses a filter field the resource does not declare', async () => {
		const { resolver } = surfaces();

		const error = await resolver.keyResults({ updates: { eq: SIGNUPS } }).catch((thrown) => thrown);

		expect(isRefusal(error)).toBe(true);
		expect((error as Error).message).toContain('QUERY_UNKNOWN_FILTER_FIELD');
	});

	it('refuses both pagination styles at once rather than silently preferring one', async () => {
		const { resolver } = surfaces();

		const error = await resolver
			.keyResults(undefined, undefined, undefined, 5, undefined, undefined, undefined, 5)
			.catch((thrown) => thrown);

		expect(isRefusal(error)).toBe(true);
		expect((error as Error).message).toContain('QUERY_NESTING_LIMIT_EXCEEDED');
	});
});

describe('KeyResultResolver — one concept, two protocols, the same operations', () => {
	it('reads one key result through the controller’s own reader, relations and all', async () => {
		const { resolver, keyResultService } = surfaces();

		expect(await resolver.keyResult(SIGNUPS)).toBe(ROWS[0]);
		// The controller's own route, not the CRUD base's: the four relations it joins are the whole
		// reason the read is a field of its own rather than the connection narrowed.
		expect(keyResultService.findAll).toHaveBeenCalledWith({
			where: { id: SIGNUPS },
			relations: ['updates', 'goal', 'lead', 'owner']
		});
	});

	it('answers null for a key result that is not there, which is the REST route’s empty envelope here', async () => {
		const { resolver, keyResultService } = surfaces();
		keyResultService.findAll.mockResolvedValueOnce({ items: [], total: 0 });

		expect(await resolver.keyResult(RETENTION)).toBeNull();
	});

	it('counts through the same service method the count route calls, with the route’s own options', async () => {
		const { resolver, keyResultService } = surfaces();

		expect(await resolver.keyResultCount()).toBe(2);
		expect(keyResultService.countBy).toHaveBeenCalledWith();
	});

	it('authors a key result through the same service method the REST route calls', async () => {
		const { resolver, keyResultService } = surfaces();

		await resolver.createKeyResult({
			name: 'Weekly sign-ups',
			type: 'NUMERICAL',
			update: 0,
			progress: 0,
			deadline: 'SPECIFIC',
			ownerId: OWNER,
			goalId: GOAL,
			organizationId: ORGANIZATION
		});

		expect(keyResultService.create).toHaveBeenCalledWith({
			name: 'Weekly sign-ups',
			type: 'NUMERICAL',
			update: 0,
			progress: 0,
			deadline: 'SPECIFIC',
			ownerId: OWNER,
			goalId: GOAL,
			organizationId: ORGANIZATION
		});
	});

	it('authors several key results through the same bulk write the REST route calls', async () => {
		const { resolver, keyResultService } = surfaces();
		const list = [{ name: 'Weekly sign-ups', goalId: GOAL }, { name: 'Net revenue retention', goalId: GOAL }];

		const answer = await resolver.createKeyResults(list as never);

		// The route hands its body's `list` to the service's own bulk write, and the field does the same.
		expect(keyResultService.createBulk).toHaveBeenCalledWith(list);
		expect(answer).toEqual(ROWS);
	});

	it('changes a key result through the route’s update-through-create, identifier included', async () => {
		const { resolver, keyResultService } = surfaces();

		await resolver.updateKeyResult({ id: SIGNUPS, progress: 80 });

		expect(keyResultService.create).toHaveBeenCalledWith({ progress: 80, id: SIGNUPS });
	});

	it('removes a key result through the same service method the REST route calls', async () => {
		const { resolver, keyResultService } = surfaces();

		expect(await resolver.deleteKeyResult(SIGNUPS)).toBe(true);
		expect(keyResultService.delete).toHaveBeenCalledWith(SIGNUPS);
	});

	it('withdraws and restores a key result through the same service methods the REST routes call', async () => {
		const { resolver, keyResultService } = surfaces();

		const withdrawn = await resolver.softDeleteKeyResult(SIGNUPS);
		expect(withdrawn.deletedAt).toBeInstanceOf(Date);
		expect(keyResultService.softRemove).toHaveBeenCalledWith(SIGNUPS);

		expect(await resolver.recoverKeyResult(SIGNUPS)).toBe(ROWS[0]);
		expect(keyResultService.softRecover).toHaveBeenCalledWith(SIGNUPS);
	});

	it('surfaces a refusal as a 4xx that is not a 404', async () => {
		const { resolver, keyResultService } = surfaces();
		const refusal = new Error('FORBIDDEN: the record belongs to another tenant');

		keyResultService.delete.mockRejectedValueOnce(refusal);

		await expect(resolver.deleteKeyResult(SIGNUPS)).rejects.toBe(refusal);
	});
});

describe('KeyResultResolver — the guard stack and the permission are the controller’s', () => {
	it('guards the resolver the way the controller is guarded, and not more widely', () => {
		expect(Reflect.getMetadata('__guards__', KeyResultController)).toEqual([TenantPermissionGuard]);
		expect(Reflect.getMetadata('__guards__', KeyResultResolver)).toEqual([
			TenantPermissionGuard,
			FeatureFlagGuard
		]);
	});

	it('runs every route under the guard chain the resolver states', () => {
		const stated = Reflect.getMetadata('__guards__', KeyResultResolver) ?? [];
		const routes = [
			'findAll',
			'findById',
			'getAll',
			'getCount',
			'pagination',
			'create',
			'createBulkKeyResults',
			'update',
			'delete',
			'softRemove',
			'softRecover'
		];

		for (const handler of routes) {
			expect([...guardsOfRoute(KeyResultController, handler), FeatureFlagGuard].sort()).toEqual(
				[...stated].sort()
			);
		}
	});

	it('states no permission on the class, because the controller states none', () => {
		expect(Reflect.getMetadata(PERMISSIONS_METADATA, KeyResultController)).toBeUndefined();
		expect(Reflect.getMetadata(PERMISSIONS_METADATA, KeyResultResolver)).toBeUndefined();
	});

	it('states on every field the permission its own route runs under, which is none', () => {
		const stated = Object.fromEntries(ROUTES.map(([field]) => [field, permissionOfField(field)]));
		const expected = Object.fromEntries(
			ROUTES.map(([field, handler]) => [field, permissionOfRoute(KeyResultController, handler)])
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
		getHandler: () => (KeyResultResolver.prototype as never)[field],
		getClass: () => KeyResultResolver,
		getType: () => 'graphql',
		getArgByIndex: () => ({ fieldName: field })
	} as unknown as ExecutionContext;
}

describe('KeyResultResolver — a capability that is switched off is not served', () => {
	it('declares the capability the commerce catalogue declares for this surface, on the class', () => {
		expect(Reflect.getMetadata(FEATURE_METADATA, KeyResultResolver)).toBe(FEATURE_GRAPHQL);
		expect(Reflect.getMetadata('__guards__', KeyResultResolver)).toContain(FeatureFlagGuard);
	});

	it('refuses a field whose capability is switched off, and names the field it refused', async () => {
		const { guard, featureService } = gate(false);

		const refusal = await guard.canActivate(graphqlContext('keyResults')).catch((thrown) => thrown);

		expect(featureService.isFeatureEnabled).toHaveBeenCalledWith(FEATURE_GRAPHQL);
		expect(refusal).toBeInstanceOf(NotFoundException);
		expect((refusal as Error).message).toContain('keyResults');
		expect((refusal as NotFoundException).getStatus()).toBe(404);
	});

	it('serves the field once the capability is switched on', async () => {
		const { guard } = gate(true);

		await expect(guard.canActivate(graphqlContext('keyResults'))).resolves.toBe(true);
	});
});
