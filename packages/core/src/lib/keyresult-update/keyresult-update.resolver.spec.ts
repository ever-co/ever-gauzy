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
import { KeyResultUpdateController } from './keyresult-update.controller';
import { KeyResultUpdateResolver } from './keyresult-update.resolver';
import { KeyResultUpdateBulkDeleteCommand } from './commands';

/**
 * The moves a key result made, over GraphQL.
 *
 * The delivered `/api/key-result-updates` controller declares four routes and inherits five, and this
 * suite pins all nine as root fields of the one composed schema — with the controller's by-key-result
 * read stated as the connection's `keyResultId` filter, because that is what it is: the list reader
 * handed one more criterion, whose path segment names the key result rather than the row.
 *
 * It also pins the two facts that make this resource worth a comment rather than a line of code: a
 * router walks a class's own methods before the base class's, so the controller's single-segment
 * `GET /:id` is registered ahead of the inherited `count` and `pagination` patterns and answers them;
 * and the delivered edit swallows its own failure, which a field that promises a row may not do.
 */

const TENANT = '00000000-0000-4000-8000-000000000001';
const ORGANIZATION = '00000000-0000-4000-8000-000000000002';
const KEY_RESULT = '00000000-0000-4000-8000-000000000080';
const FIRST_MOVE = '00000000-0000-4000-8000-000000000081';
const SECOND_MOVE = '00000000-0000-4000-8000-000000000082';

/** The rows a scripted service answers with, in the order the delivered list read returns them. */
const ROWS = [
	{
		id: SECOND_MOVE,
		tenantId: TENANT,
		organizationId: ORGANIZATION,
		update: 1500,
		progress: 75,
		owner: 'the measure job',
		status: 'ON_TRACK',
		keyResultId: KEY_RESULT,
		createdAt: new Date('2026-03-01T10:00:00.000Z'),
		updatedAt: new Date('2026-03-01T10:00:00.000Z')
	},
	{
		id: FIRST_MOVE,
		tenantId: TENANT,
		organizationId: ORGANIZATION,
		update: 1200,
		progress: 60,
		owner: 'the measure job',
		status: 'ON_TRACK',
		keyResultId: KEY_RESULT,
		createdAt: new Date('2026-02-01T10:00:00.000Z'),
		updatedAt: new Date('2026-02-01T10:00:00.000Z')
	}
];

/** The resolver, over a scripted service and command bus. */
function surfaces() {
	const keyResultUpdateService = {
		findAll: jest.fn().mockResolvedValue({ items: ROWS, total: ROWS.length }),
		findOneByIdString: jest.fn().mockResolvedValue(ROWS[0]),
		countBy: jest.fn().mockResolvedValue(ROWS.length),
		create: jest.fn().mockResolvedValue(ROWS[0]),
		delete: jest.fn().mockResolvedValue({ affected: 1 }),
		softRemove: jest.fn().mockResolvedValue({ ...ROWS[0], deletedAt: new Date('2026-04-01T10:00:00.000Z') }),
		softRecover: jest.fn().mockResolvedValue(ROWS[0])
	};
	const commandBus = { execute: jest.fn().mockResolvedValue(undefined) };

	return {
		keyResultUpdateService,
		commandBus,
		resolver: new KeyResultUpdateResolver(keyResultUpdateService as never, commandBus as never)
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
function permissionOfRoute(controller: typeof KeyResultUpdateController, handler: string): unknown {
	const handlers = controller.prototype as unknown as Record<string, object>;

	return (
		Reflect.getMetadata(PERMISSIONS_METADATA, handlers[handler]) ??
		Reflect.getMetadata(PERMISSIONS_METADATA, controller)
	);
}

/** The guards one route actually runs under: the controller's chain, then whatever the handler states. */
function guardsOfRoute(controller: typeof KeyResultUpdateController, handler: string): unknown[] {
	const handlers = controller.prototype as unknown as Record<string, object>;
	const declared = Reflect.getMetadata('__guards__', controller) ?? [];
	const restated = Reflect.getMetadata('__guards__', handlers[handler]) ?? [];

	return Array.from(new Set([...declared, ...restated]));
}

/** The permission one resolver field runs under. */
function permissionOfField(field: string): unknown {
	const fields = KeyResultUpdateResolver.prototype as unknown as Record<string, object>;

	return Reflect.getMetadata(PERMISSIONS_METADATA, fields[field]);
}

/** Every route this domain mirrors, paired with the root field that mirrors it. */
const ROUTES: Array<[string, string]> = [
	['keyResultUpdates', 'findAll'],
	['keyResultUpdate', 'findById'],
	['keyResultUpdateCount', 'getCount'],
	['createKeyResultUpdate', 'create'],
	['updateKeyResultUpdate', 'update'],
	['deleteKeyResultUpdate', 'delete'],
	['deleteKeyResultUpdates', 'deleteBulkByKeyResultId'],
	['softDeleteKeyResultUpdate', 'softRemove'],
	['recoverKeyResultUpdate', 'softRecover']
];

describe('KeyResultUpdateResolver — the SDL declares the capabilities the REST routes serve', () => {
	it('declares the connection query, the node query and the count', () => {
		expect(rootFields('Query')).toEqual(
			expect.arrayContaining(['keyResultUpdates', 'keyResultUpdate', 'keyResultUpdateCount'])
		);
	});

	it('declares one mutation per delivered write route, the bulk removal included', () => {
		expect(rootFields('Mutation')).toEqual(
			expect.arrayContaining([
				'createKeyResultUpdate',
				'updateKeyResultUpdate',
				'deleteKeyResultUpdate',
				'deleteKeyResultUpdates',
				'softDeleteKeyResultUpdate',
				'recoverKeyResultUpdate'
			])
		);
	});

	it('declares the reads and the writes the controller serves, and no more', () => {
		// The controller's own `GET /:id` is the by-key-result read, so it is stated as the connection's
		// `keyResultId` filter and not as a root field of its own.
		expect(declaredRootFields('keyresult-update.api.gql', 'Query')).toEqual([
			'keyResultUpdates',
			'keyResultUpdate',
			'keyResultUpdateCount'
		]);
		expect(declaredRootFields('keyresult-update.api.gql', 'Mutation')).toEqual([
			'createKeyResultUpdate',
			'updateKeyResultUpdate',
			'deleteKeyResultUpdate',
			'deleteKeyResultUpdates',
			'softDeleteKeyResultUpdate',
			'recoverKeyResultUpdate'
		]);
	});

	it('declares the connection, its edges, its filters and its sorts', () => {
		expect(printed).toMatch(
			/type KeyResultUpdateConnection \{\s*nodes: \[KeyResultUpdate!\]!\s*edges: \[KeyResultUpdateEdge!\]!\s*totalCount: Int!\s*pageInfo: PageInfo!\s*\}/
		);
		expect(printed).toMatch(/type KeyResultUpdateEdge \{\s*node: KeyResultUpdate!\s*cursor: String!\s*\}/);
		expect(printed).toMatch(/input KeyResultUpdateFilter \{/);
		expect(printed).toMatch(/input KeyResultUpdateSort \{/);
		expect(printed).toMatch(
			/enum KeyResultUpdateSortField \{\s*createdAt\s*updatedAt\s*progress\s*status\s*\}/
		);
	});

	it('carries the key result as an identifier, because that is the column the row holds', () => {
		const body = typeBody('KeyResultUpdate');

		expect(body).toMatch(/keyResultId: ID/);
		expect(body).not.toMatch(/\n\tkeyResult:/);
		expect(body).toMatch(/progress: Int!/);
		expect(body).toMatch(/update: Int!/);
		expect(body).toMatch(/deletedAt: DateTime/);
	});

	it('offers no argument it cannot honour', () => {
		expect(printed).toMatch(/keyResultUpdates\([^)]*withDeleted/);
		expect(printed).not.toMatch(/keyResultUpdateCount\(/);
	});
});

describe('KeyResultUpdateResolver — the delivered router answers two paths with the by-key-result read', () => {
	it('registers the controller’s own single-segment pattern before the routes it inherits', () => {
		const order = new MetadataScanner().getAllMethodNames(KeyResultUpdateController.prototype);

		expect(order.indexOf('getAll')).toBeGreaterThanOrEqual(0);
		expect(order.indexOf('getAll')).toBeLessThan(order.indexOf('getCount'));
		expect(order.indexOf('getAll')).toBeLessThan(order.indexOf('pagination'));
	});

	it('states the by-key-result read as the connection narrowed, and the count under its own name', () => {
		expect(rootFields('Query')).toEqual(expect.arrayContaining(['keyResultUpdate', 'keyResultUpdateCount']));
	});
});

describe('KeyResultUpdateResolver — the connection contract', () => {
	it('reads the list the way the delivered route reads it, and answers nodes, edges and a total', async () => {
		const { resolver, keyResultUpdateService } = surfaces();

		const connection = await resolver.keyResultUpdates(undefined, undefined, undefined, 20);

		expect(keyResultUpdateService.findAll).toHaveBeenCalledWith({ where: {}, relations: ['keyResult'] });
		expect(connection.nodes).toHaveLength(2);
		expect(connection.totalCount).toBe(2);
		expect(connection.pageInfo.startCursor).toBe(connection.edges[0].cursor);
		expect(connection.pageInfo.endCursor).toBe(connection.edges[1].cursor);
		expect(CursorCodec.decode(connection.edges[0].cursor).id).toBe(SECOND_MOVE);
	});

	it('answers newest first when the caller states no order', async () => {
		const { resolver } = surfaces();

		expect((await resolver.keyResultUpdates()).nodes.map((node) => node.id)).toEqual([SECOND_MOVE, FIRST_MOVE]);
	});

	it('narrows by the fields the filter declares, a key result’s history among them', async () => {
		const { resolver } = surfaces();

		// One key result's updates are this connection narrowed by `keyResultId` — the read the
		// controller's own route performs, stated in this protocol's vocabulary.
		expect(
			(await resolver.keyResultUpdates({ keyResultId: { eq: KEY_RESULT } })).nodes.map((node) => node.id)
		).toEqual([SECOND_MOVE, FIRST_MOVE]);
		expect((await resolver.keyResultUpdates({ progress: { gte: 70 } })).nodes.map((node) => node.id)).toEqual([
			SECOND_MOVE
		]);
		expect((await resolver.keyResultUpdates({ status: { eq: 'AT_RISK' } })).totalCount).toBe(0);
	});

	it('orders by the keys the sort enum offers', async () => {
		const { resolver } = surfaces();

		expect(
			(await resolver.keyResultUpdates(undefined, [{ field: 'progress', direction: 'ASC' }])).nodes.map(
				(node) => node.id
			)
		).toEqual([FIRST_MOVE, SECOND_MOVE]);
	});

	it('resumes a walk from an opaque cursor, forwards and backwards', async () => {
		const { resolver } = surfaces();
		const all = await resolver.keyResultUpdates(undefined, undefined, undefined, 20);

		expect(
			(
				await resolver.keyResultUpdates(undefined, undefined, { first: 1, after: all.edges[0].cursor })
			).nodes.map((node) => node.id)
		).toEqual([FIRST_MOVE]);
		expect(
			(
				await resolver.keyResultUpdates(undefined, undefined, { last: 1, before: all.edges[1].cursor })
			).nodes.map((node) => node.id)
		).toEqual([SECOND_MOVE]);
	});

	it('refuses a sort field the resource does not declare, with the query protocol’s own code', async () => {
		const { resolver } = surfaces();

		const error = await resolver
			.keyResultUpdates(undefined, [{ field: 'keyResult', direction: 'ASC' }] as never)
			.catch((thrown) => thrown);

		expect(isRefusal(error)).toBe(true);
		expect((error as Error).message).toContain('QUERY_SORT_NOT_ALLOWED');
	});

	it('refuses a filter field the resource does not declare', async () => {
		const { resolver } = surfaces();

		const error = await resolver.keyResultUpdates({ keyResult: { eq: KEY_RESULT } }).catch((thrown) => thrown);

		expect(isRefusal(error)).toBe(true);
		expect((error as Error).message).toContain('QUERY_UNKNOWN_FILTER_FIELD');
	});

	it('refuses both pagination styles at once rather than silently preferring one', async () => {
		const { resolver } = surfaces();

		const error = await resolver
			.keyResultUpdates(undefined, undefined, undefined, 5, undefined, undefined, undefined, 5)
			.catch((thrown) => thrown);

		expect(isRefusal(error)).toBe(true);
		expect((error as Error).message).toContain('QUERY_NESTING_LIMIT_EXCEEDED');
	});
});

describe('KeyResultUpdateResolver — one concept, two protocols, the same operations', () => {
	it('reads one update through the same service method the REST route calls', async () => {
		const { resolver, keyResultUpdateService } = surfaces();

		expect(await resolver.keyResultUpdate(SECOND_MOVE)).toBe(ROWS[0]);
		expect(keyResultUpdateService.findOneByIdString).toHaveBeenCalledWith(SECOND_MOVE);
	});

	it('answers null for an update that is not there, which is the REST route’s 404 here', async () => {
		const { resolver, keyResultUpdateService } = surfaces();
		keyResultUpdateService.findOneByIdString.mockRejectedValueOnce(new NotFoundException());

		expect(await resolver.keyResultUpdate(FIRST_MOVE)).toBeNull();
	});

	it('counts through the same service method the count route calls, with the route’s own options', async () => {
		const { resolver, keyResultUpdateService } = surfaces();

		expect(await resolver.keyResultUpdateCount()).toBe(2);
		expect(keyResultUpdateService.countBy).toHaveBeenCalledWith();
	});

	it('records a move through the same service method the REST route calls', async () => {
		const { resolver, keyResultUpdateService } = surfaces();

		await resolver.createKeyResultUpdate({
			owner: 'the measure job',
			progress: 75,
			update: 1500,
			status: 'ON_TRACK',
			keyResultId: KEY_RESULT,
			organizationId: ORGANIZATION
		});

		expect(keyResultUpdateService.create).toHaveBeenCalledWith({
			owner: 'the measure job',
			progress: 75,
			update: 1500,
			status: 'ON_TRACK',
			keyResultId: KEY_RESULT,
			organizationId: ORGANIZATION
		});
	});

	it('corrects a move through the route’s update-through-create, identifier included', async () => {
		const { resolver, keyResultUpdateService } = surfaces();

		await resolver.updateKeyResultUpdate({ id: SECOND_MOVE, progress: 80 });

		expect(keyResultUpdateService.create).toHaveBeenCalledWith({ progress: 80, id: SECOND_MOVE });
	});

	it('lets a refused correction travel instead of answering the empty body the route answers', async () => {
		const { resolver, keyResultUpdateService } = surfaces();
		const refusal = new Error('BAD_REQUEST: the record could not be saved');

		keyResultUpdateService.create.mockRejectedValueOnce(refusal);

		// The delivered route catches this and returns nothing; a field that promises a row cannot, so
		// the refusal is what a caller reads.
		await expect(resolver.updateKeyResultUpdate({ id: FIRST_MOVE, progress: 10 })).rejects.toBe(refusal);
	});

	it('removes one update through the same service method the REST route calls', async () => {
		const { resolver, keyResultUpdateService } = surfaces();

		expect(await resolver.deleteKeyResultUpdate(SECOND_MOVE)).toBe(true);
		expect(keyResultUpdateService.delete).toHaveBeenCalledWith(SECOND_MOVE);
	});

	it('removes a key result’s whole history through the command the bulk route dispatches', async () => {
		const { resolver, commandBus } = surfaces();

		expect(await resolver.deleteKeyResultUpdates(KEY_RESULT)).toBe(true);

		const command = commandBus.execute.mock.calls[0][0];
		expect(command).toBeInstanceOf(KeyResultUpdateBulkDeleteCommand);
		expect(command.id).toBe(KEY_RESULT);
	});

	it('withdraws and restores an update through the same service methods the REST routes call', async () => {
		const { resolver, keyResultUpdateService } = surfaces();

		const withdrawn = await resolver.softDeleteKeyResultUpdate(SECOND_MOVE);
		expect(withdrawn.deletedAt).toBeInstanceOf(Date);
		expect(keyResultUpdateService.softRemove).toHaveBeenCalledWith(SECOND_MOVE);

		expect(await resolver.recoverKeyResultUpdate(SECOND_MOVE)).toBe(ROWS[0]);
		expect(keyResultUpdateService.softRecover).toHaveBeenCalledWith(SECOND_MOVE);
	});

	it('surfaces a refusal as a 4xx that is not a 404', async () => {
		const { resolver, keyResultUpdateService } = surfaces();
		const refusal = new Error('FORBIDDEN: the record belongs to another tenant');

		keyResultUpdateService.delete.mockRejectedValueOnce(refusal);

		await expect(resolver.deleteKeyResultUpdate(SECOND_MOVE)).rejects.toBe(refusal);
	});
});

describe('KeyResultUpdateResolver — the guard stack and the permission are the controller’s', () => {
	it('guards the resolver the way the controller is guarded, and not more widely', () => {
		expect(Reflect.getMetadata('__guards__', KeyResultUpdateController)).toEqual([TenantPermissionGuard]);
		expect(Reflect.getMetadata('__guards__', KeyResultUpdateResolver)).toEqual([
			TenantPermissionGuard,
			FeatureFlagGuard
		]);
	});

	it('runs every route under the guard chain the resolver states', () => {
		const stated = Reflect.getMetadata('__guards__', KeyResultUpdateResolver) ?? [];
		const routes = [
			'findAll',
			'findById',
			'getAll',
			'getCount',
			'pagination',
			'create',
			'update',
			'delete',
			'deleteBulkByKeyResultId',
			'softRemove',
			'softRecover'
		];

		for (const handler of routes) {
			expect([...guardsOfRoute(KeyResultUpdateController, handler), FeatureFlagGuard].sort()).toEqual(
				[...stated].sort()
			);
		}
	});

	it('states no permission on the class, because the controller states none', () => {
		expect(Reflect.getMetadata(PERMISSIONS_METADATA, KeyResultUpdateController)).toBeUndefined();
		expect(Reflect.getMetadata(PERMISSIONS_METADATA, KeyResultUpdateResolver)).toBeUndefined();
	});

	it('states on every field the permission its own route runs under, which is none', () => {
		const stated = Object.fromEntries(ROUTES.map(([field]) => [field, permissionOfField(field)]));
		const expected = Object.fromEntries(
			ROUTES.map(([field, handler]) => [field, permissionOfRoute(KeyResultUpdateController, handler)])
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
		getHandler: () => (KeyResultUpdateResolver.prototype as never)[field],
		getClass: () => KeyResultUpdateResolver,
		getType: () => 'graphql',
		getArgByIndex: () => ({ fieldName: field })
	} as unknown as ExecutionContext;
}

describe('KeyResultUpdateResolver — a capability that is switched off is not served', () => {
	it('declares the capability the commerce catalogue declares for this surface, on the class', () => {
		expect(Reflect.getMetadata(FEATURE_METADATA, KeyResultUpdateResolver)).toBe(FEATURE_GRAPHQL);
		expect(Reflect.getMetadata('__guards__', KeyResultUpdateResolver)).toContain(FeatureFlagGuard);
	});

	it('refuses a field whose capability is switched off, and names the field it refused', async () => {
		const { guard, featureService } = gate(false);

		const refusal = await guard.canActivate(graphqlContext('keyResultUpdates')).catch((thrown) => thrown);

		expect(featureService.isFeatureEnabled).toHaveBeenCalledWith(FEATURE_GRAPHQL);
		expect(refusal).toBeInstanceOf(NotFoundException);
		expect((refusal as Error).message).toContain('keyResultUpdates');
		expect((refusal as NotFoundException).getStatus()).toBe(404);
	});

	it('serves the field once the capability is switched on', async () => {
		const { guard } = gate(true);

		await expect(guard.canActivate(graphqlContext('keyResultUpdates'))).resolves.toBe(true);
	});
});
