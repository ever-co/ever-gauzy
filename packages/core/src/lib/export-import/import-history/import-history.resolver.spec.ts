/**
 * 🛑 This import must stay FIRST, before any import that pulls a core service or controller — see
 * `channel.controller.spec.ts` for the cycle it avoids: an entity decorator is undefined when the
 * entity applies it if the graph is entered through the validators rather than through the entities.
 */
import '../../core/entities/internal';

import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { ExecutionContext, NotFoundException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { buildSchema, printSchema } from 'graphql';
import { ImportStatusEnum, PermissionsEnum } from '@gauzy/contracts';
import { FEATURE_METADATA, PERMISSIONS_METADATA } from '@gauzy/constants';
import { CursorCodec } from '../../api/cursor';
import { FeatureFlagGuard, PermissionGuard, TenantPermissionGuard } from '../../shared/guards';
import { ImportHistoryController } from './import-history.controller';
import { ImportHistoryResolver } from './import-history.resolver';

/**
 * The import ledger over GraphQL.
 *
 * The delivered REST route answers the list of imports that were taken in. This suite pins what the
 * two-protocol doctrine makes of a resource that serves exactly one route:
 *
 * - the ledger is a connection with the platform's own cursor codec behind it, so a cursor obtained over
 *   REST resumes here and a refusal is the query protocol's own code;
 * - the field reaches the same service method the REST route reaches, so a client does not choose a
 *   better surface by choosing a protocol;
 * - **both class permissions are carried**, because the controller states both on its class and neither
 *   on its handler;
 * - **no node, no count and no write are declared**, because the controller serves none: a ledger entry
 *   is recorded by the import path itself, and a capability GraphQL has but REST does not is the
 *   asymmetry the two-protocol rule forbids;
 * - **the storage key is not a member**, because the entity's own serialisation excludes it, and the URL
 *   the projection answers in its place is.
 */

const TENANT = '00000000-0000-4000-8000-000000000001';
const FIRST = '00000000-0000-4000-8000-000000000010';
const SECOND = '00000000-0000-4000-8000-000000000011';

/** The ledger entries a scripted reader answers with, in the order the delivered read returns them. */
const ROWS = [
	{
		id: FIRST,
		tenantId: TENANT,
		file: 'export-2026-03.zip',
		status: ImportStatusEnum.SUCCESS,
		size: 20480,
		importDate: new Date('2026-03-01T10:00:00.000Z'),
		fullUrl: 'https://storage.example/import/export-2026-03.zip',
		createdAt: new Date('2026-03-01T10:00:00.000Z'),
		updatedAt: new Date('2026-03-01T10:00:00.000Z')
	},
	{
		id: SECOND,
		tenantId: TENANT,
		file: 'export-2026-02.zip',
		status: ImportStatusEnum.FAILED,
		size: 10240,
		importDate: new Date('2026-02-01T10:00:00.000Z'),
		fullUrl: undefined,
		createdAt: new Date('2026-02-01T10:00:00.000Z'),
		updatedAt: new Date('2026-02-01T10:00:00.000Z')
	}
];

/** The resolver, over a scripted service. */
function surfaces() {
	const importHistoryService = {
		findAll: jest.fn().mockResolvedValue({ items: ROWS, total: ROWS.length })
	};

	return {
		importHistoryService,
		resolver: new ImportHistoryResolver(importHistoryService as never)
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
 * boot loader globs. The domain sits two levels below the library root, so the walk starts there.
 */
function composedSchema(): string {
	const root = join(__dirname, '..', '..');
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

/** The root fields this domain contributes. */
function ownedRootFields(operation: 'Query' | 'Mutation'): string[] {
	return rootFields(operation)
		.filter((field) => field.toLowerCase().includes('importhistor'))
		.sort();
}

/** The printed body of one object type, so a member it must not carry can be asserted absent. */
function typeBody(name: string): string {
	return printed.match(new RegExp(`type ${name} \\{([\\s\\S]*?)\\n\\}`))?.[1] ?? '';
}

/** The printed body of one input object, so a member no filter declares can be asserted absent. */
function inputBody(name: string): string {
	return printed.match(new RegExp(`input ${name} \\{([\\s\\S]*?)\\n\\}`))?.[1] ?? '';
}

/** The handlers of one controller, as functions, inherited ones included. */
function handlersOf(controller: typeof ImportHistoryController): Record<string, object> {
	return controller.prototype as unknown as Record<string, object>;
}

/**
 * The permission one route runs under: what its handler states, else what its controller states.
 *
 * This is the rule the guards themselves apply — the reflector's `getAllAndOverride` over
 * `[handler, class]` — restated here, so the resolver is held to the controller's own metadata rather
 * than to a second copy of the same list written out in this file.
 */
function permissionOfRoute(controller: typeof ImportHistoryController, handler: string): unknown {
	return (
		Reflect.getMetadata(PERMISSIONS_METADATA, handlersOf(controller)[handler]) ??
		Reflect.getMetadata(PERMISSIONS_METADATA, controller)
	);
}

/**
 * The guards one route actually runs under: the controller's chain followed by whatever the handler
 * states of its own, which is the order the guard context creator concatenates them in.
 */
function guardsOfRoute(controller: typeof ImportHistoryController, handler: string): unknown[] {
	const declared = Reflect.getMetadata('__guards__', controller) ?? [];
	const restated = Reflect.getMetadata('__guards__', handlersOf(controller)[handler]) ?? [];

	return Array.from(new Set([...declared, ...restated]));
}

/** The permission one resolver field runs under. */
function permissionOfField(field: string): unknown {
	const fields = ImportHistoryResolver.prototype as unknown as Record<string, object>;

	return Reflect.getMetadata(PERMISSIONS_METADATA, fields[field]);
}

describe('ImportHistoryResolver — the SDL declares the capability the REST route serves', () => {
	it('declares the ledger as a connection, and nothing else', () => {
		expect(rootFields('Query')).toEqual(expect.arrayContaining(['importHistories']));
		expect(ownedRootFields('Query')).toEqual(['importHistories']);
		expect(ownedRootFields('Mutation')).toEqual([]);
	});

	it('declares the connection, its edges, its filters and its sorts', () => {
		expect(printed).toMatch(
			/type ImportHistoryConnection \{\s*nodes: \[ImportHistory!\]!\s*edges: \[ImportHistoryEdge!\]!\s*totalCount: Int!\s*pageInfo: PageInfo!\s*\}/
		);
		expect(printed).toMatch(/type ImportHistoryEdge \{\s*node: ImportHistory!\s*cursor: String!\s*\}/);
		expect(printed).toMatch(/input ImportHistoryFilter \{/);
		expect(printed).toMatch(/input ImportHistorySort \{/);
		expect(printed).toMatch(
			/enum ImportHistorySortField \{\s*importDate\s*createdAt\s*updatedAt\s*file\s*size\s*status\s*\}/
		);
	});

	it('declares no node read, no count and no write, because the controller serves none', () => {
		expect(printed).not.toMatch(/\bimportHistory\(/);
		expect(printed).not.toMatch(/importHistoryCount/);
		expect(ownedRootFields('Mutation')).toEqual([]);
	});

	it('carries the delivered projection, and withholds the storage key the entity excludes', () => {
		const body = typeBody('ImportHistory');

		expect(body).toMatch(/file: String!/);
		expect(body).toMatch(/status: String!/);
		expect(body).toMatch(/importDate: DateTime/);
		// The entity excludes the storage key from every plain serialisation, so a member for it here
		// would reach past the delivered projection for a value the projection withholds.
		expect(body).not.toMatch(/\bpath: String/);
		// The URL the projection answers in its place is a member, because it is what the delivered read
		// answers on every row it can resolve the storage provider for.
		expect(body).toMatch(/fullUrl: String/);
		// The ledger row carries no organization: the entity is tenant-scoped.
		expect(body).not.toContain('organizationId');
	});

	it('offers no argument it cannot honour', () => {
		expect(printed).not.toMatch(/importHistories\([^)]*withDeleted/);
		// The storage key and the URL resolved from it are not filterable: the first is withheld and the
		// second is not stored.
		expect(inputBody('ImportHistoryFilter')).not.toMatch(/\bpath:/);
		expect(inputBody('ImportHistoryFilter')).not.toMatch(/\bfullUrl:/);
	});
});

describe('ImportHistoryResolver — the connection contract', () => {
	it('answers the list with nodes, edges, a total and the boundary cursors', async () => {
		const { resolver, importHistoryService } = surfaces();

		const connection = await resolver.importHistories(undefined, undefined, undefined, 20);

		// The read is the one the REST list route performs, through the same service method, which takes
		// no argument: the delivered read is scoped and ordered by the service itself.
		expect(importHistoryService.findAll).toHaveBeenCalledWith();
		expect(connection.nodes).toHaveLength(2);
		expect(connection.totalCount).toBe(2);
		expect(connection.pageInfo.startCursor).toBe(connection.edges[0].cursor);
		expect(connection.pageInfo.endCursor).toBe(connection.edges[1].cursor);
		expect(connection.pageInfo.hasNextPage).toBe(false);
		// The cursor is the platform's own codec, so the same cursor is valid on the REST surface.
		expect(CursorCodec.decode(connection.edges[0].cursor).id).toBe(FIRST);
	});

	it('keeps the ledger’s own order when the caller states none', async () => {
		const { resolver } = surfaces();

		const connection = await resolver.importHistories();

		expect(connection.nodes.map((node) => node.id)).toEqual([FIRST, SECOND]);
	});

	it('narrows by the fields the filter declares', async () => {
		const { resolver } = surfaces();

		const byStatus = await resolver.importHistories({ status: { eq: ImportStatusEnum.FAILED } });
		expect(byStatus.nodes.map((node) => node.id)).toEqual([SECOND]);

		const byFile = await resolver.importHistories({ file: { ilike: '%2026-03%' } });
		expect(byFile.nodes.map((node) => node.id)).toEqual([FIRST]);

		const bigEnough = await resolver.importHistories({ size: { gte: 20000 } });
		expect(bigEnough.nodes.map((node) => node.id)).toEqual([FIRST]);
	});

	it('orders by the keys the sort enum offers', async () => {
		const { resolver } = surfaces();

		const byFile = await resolver.importHistories(undefined, [{ field: 'file', direction: 'ASC' }]);
		expect(byFile.nodes.map((node) => node.id)).toEqual([SECOND, FIRST]);

		const bySize = await resolver.importHistories(undefined, [{ field: 'size', direction: 'ASC' }]);
		expect(bySize.nodes.map((node) => node.id)).toEqual([SECOND, FIRST]);
	});

	it('resumes a walk from an opaque cursor', async () => {
		const { resolver } = surfaces();
		const first = await resolver.importHistories(undefined, undefined, undefined, 1);

		expect(first.nodes.map((node) => node.id)).toEqual([FIRST]);

		const second = await resolver.importHistories(undefined, undefined, {
			first: 1,
			after: first.pageInfo.endCursor ?? undefined
		});

		expect(second.nodes.map((node) => node.id)).toEqual([SECOND]);
		expect(second.pageInfo.hasPreviousPage).toBe(true);
	});

	it('walks backwards from a cursor as well as forwards', async () => {
		const { resolver } = surfaces();
		const all = await resolver.importHistories(undefined, undefined, undefined, 20);

		const last = await resolver.importHistories(undefined, undefined, {
			last: 1,
			before: all.edges[1].cursor
		});

		expect(last.nodes.map((node) => node.id)).toEqual([FIRST]);
		expect(last.pageInfo.hasNextPage).toBe(true);
	});

	it('refuses a sort field the resource does not declare, with the query protocol’s own code', async () => {
		const { resolver } = surfaces();

		const error = await resolver
			.importHistories(undefined, [{ field: 'path', direction: 'ASC' }] as never)
			.catch((thrown) => thrown);

		expect(isRefusal(error)).toBe(true);
		expect((error as Error).message).toContain('QUERY_SORT_NOT_ALLOWED');
	});

	it('refuses the storage key as a filter, because it is not a member of this projection', async () => {
		const { resolver } = surfaces();

		const error = await resolver.importHistories({ path: { eq: 'import/export.zip' } }).catch((thrown) => thrown);

		expect(isRefusal(error)).toBe(true);
		expect((error as Error).message).toContain('QUERY_UNKNOWN_FILTER_FIELD');
	});

	it('refuses both pagination styles at once rather than silently preferring one', async () => {
		const { resolver } = surfaces();

		const error = await resolver
			.importHistories(undefined, undefined, undefined, 5, undefined, undefined, undefined, 5)
			.catch((thrown) => thrown);

		expect(isRefusal(error)).toBe(true);
		expect((error as Error).message).toContain('QUERY_NESTING_LIMIT_EXCEEDED');
	});
});

describe('ImportHistoryResolver — the guard stack and the permissions are the controller’s', () => {
	it('guards the resolver the way the controller is guarded', () => {
		const resolverGuards = Reflect.getMetadata('__guards__', ImportHistoryResolver) ?? [];
		const controllerGuards = Reflect.getMetadata('__guards__', ImportHistoryController) ?? [];

		expect(resolverGuards).toEqual(expect.arrayContaining([TenantPermissionGuard, PermissionGuard]));
		expect(controllerGuards).toEqual(expect.arrayContaining([TenantPermissionGuard, PermissionGuard]));
	});

	it('runs the route under the guard chain the resolver states', () => {
		expect([...guardsOfRoute(ImportHistoryController, 'findAll'), FeatureFlagGuard].sort()).toEqual(
			[...(Reflect.getMetadata('__guards__', ImportHistoryResolver) ?? [])].sort()
		);
	});

	it('states on the class the permissions the controller states on the class', () => {
		expect(Reflect.getMetadata(PERMISSIONS_METADATA, ImportHistoryResolver)).toEqual(
			Reflect.getMetadata(PERMISSIONS_METADATA, ImportHistoryController)
		);
		expect(permissionOfField('importHistories')).toEqual([
			PermissionsEnum.ALL_ORG_VIEW,
			PermissionsEnum.IMPORT_ADD
		]);
	});

	it('states on the field the permission its own route runs under', () => {
		expect(permissionOfField('importHistories')).toEqual(
			permissionOfRoute(ImportHistoryController, 'findAll')
		);
		// The controller states both on the class and neither on the handler, so the two are one scope.
		expect(Reflect.getMetadata(PERMISSIONS_METADATA, handlersOf(ImportHistoryController)['findAll'])).toBeUndefined();
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
		getHandler: () => (ImportHistoryResolver.prototype as never)[field],
		getClass: () => ImportHistoryResolver,
		getType: () => 'graphql',
		getArgByIndex: () => ({ fieldName: field })
	} as unknown as ExecutionContext;
}

describe('ImportHistoryResolver — a capability that is switched off is not served', () => {
	it('declares the capability the commerce catalogue declares for this surface, on the class', () => {
		expect(Reflect.getMetadata(FEATURE_METADATA, ImportHistoryResolver)).toBe(FEATURE_GRAPHQL);
		expect(Reflect.getMetadata('__guards__', ImportHistoryResolver)).toContain(FeatureFlagGuard);
	});

	it('refuses the field whose capability is switched off, and names the field it refused', async () => {
		const { guard, featureService } = gate(false);

		const refusal = await guard.canActivate(graphqlContext('importHistories')).catch((thrown) => thrown);

		expect(featureService.isFeatureEnabled).toHaveBeenCalledWith(FEATURE_GRAPHQL);
		expect(refusal).toBeInstanceOf(NotFoundException);
		expect((refusal as Error).message).toContain('importHistories');
		expect((refusal as NotFoundException).getStatus()).toBe(404);
	});

	it('serves the field once the capability is switched on', async () => {
		const { guard } = gate(true);

		await expect(guard.canActivate(graphqlContext('importHistories'))).resolves.toBe(true);
	});
});
