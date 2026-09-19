/**
 * 🛑 This import must stay FIRST, before any import that pulls a core service or controller — see
 * `channel.controller.spec.ts` for the cycle it avoids: an entity decorator is undefined when the
 * entity applies it if the graph is entered through the validators rather than through the entities.
 */
import '../core/entities/internal';

import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { buildSchema, printSchema } from 'graphql';
import { PermissionsEnum } from '@gauzy/contracts';
import { FEATURE_METADATA, PERMISSIONS_METADATA } from '@gauzy/constants';
import { CursorCodec } from '../api/cursor';
import { FeatureFlagGuard, PermissionGuard, TenantPermissionGuard } from '../shared/guards';
import { ApiCallLogController } from './api-call-log.controller';
import { ApiCallLogResolver } from './api-call-log.resolver';

/**
 * The API call log over GraphQL.
 *
 * The delivered controller serves two routes — a filtered list read and a removal that is hard or soft
 * depending on a flag — and inherits nothing, because it does not extend the CRUD base. This suite pins
 * the half of the two-protocol doctrine that is easy to get quietly wrong:
 *
 * - both capabilities are root fields of the one composed schema, and the list is a connection with the
 *   platform's own cursor codec behind it;
 * - the list reaches the same `findAllLogs` call the route makes, and the removal reaches the same
 *   `delete` / `softDelete` branch the route's flag selects;
 * - **the guard chain and the permission pair are the controller's**, stated on the class there and on
 *   both fields here;
 * - the capabilities the routes do not serve — a count, a single row — are not declared at all.
 */

const TENANT = '00000000-0000-4000-8000-000000000001';
const ORGANIZATION = '00000000-0000-4000-8000-000000000002';
const CORRELATION = '00000000-0000-4000-8000-000000000030';
const RECENT = '00000000-0000-4000-8000-000000000010';
const OLDER = '00000000-0000-4000-8000-000000000011';

/** The rows a scripted service answers with, in the order the delivered reader returns them. */
const ROWS = [
	{
		id: RECENT,
		tenantId: TENANT,
		organizationId: ORGANIZATION,
		correlationId: CORRELATION,
		url: '/api/invoice',
		method: 'POST',
		statusCode: 201,
		requestTime: new Date('2026-03-01T10:00:00.000Z'),
		responseTime: new Date('2026-03-01T10:00:00.120Z'),
		ipAddress: '203.0.113.7',
		protocol: 'https',
		userAgent: 'Mozilla/5.0',
		origin: 'https://app.example.test',
		userId: '00000000-0000-4000-8000-000000000040',
		requestHeaders: { 'content-type': 'application/json' },
		requestBody: { amount: '10.000000' },
		responseBody: { id: '00000000-0000-4000-8000-000000000050' },
		createdAt: new Date('2026-03-01T10:00:00.000Z'),
		updatedAt: new Date('2026-03-01T10:00:00.000Z')
	},
	{
		id: OLDER,
		tenantId: TENANT,
		organizationId: ORGANIZATION,
		correlationId: CORRELATION,
		url: '/api/invoice',
		method: 'GET',
		statusCode: 500,
		requestTime: new Date('2026-02-01T10:00:00.000Z'),
		responseTime: new Date('2026-02-01T10:00:00.400Z'),
		ipAddress: '203.0.113.8',
		protocol: 'https',
		userAgent: 'curl/8.0',
		userId: '00000000-0000-4000-8000-000000000041',
		requestHeaders: {},
		requestBody: {},
		responseBody: { message: 'Internal server error' },
		createdAt: new Date('2026-02-01T10:00:00.000Z'),
		updatedAt: new Date('2026-02-01T10:00:00.000Z')
	}
];

/** The resolver, over a scripted service. */
function surfaces() {
	const apiCallLogService = {
		findAllLogs: jest.fn().mockResolvedValue({ items: ROWS, total: ROWS.length }),
		delete: jest.fn().mockResolvedValue({ affected: 1 }),
		softDelete: jest.fn().mockResolvedValue({ ...ROWS[0], deletedAt: new Date('2026-04-01T10:00:00.000Z') })
	};

	return {
		apiCallLogService,
		resolver: new ApiCallLogResolver(apiCallLogService as never)
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
		.filter((field) => field.toLowerCase().includes('apicalllog'))
		.sort();
}

/** The permission one route runs under: what its handler states, else what its controller states. */
function permissionOfRoute(controller: typeof ApiCallLogController, handler: string): unknown {
	const handlers = controller.prototype as unknown as Record<string, object>;

	return (
		Reflect.getMetadata(PERMISSIONS_METADATA, handlers[handler]) ??
		Reflect.getMetadata(PERMISSIONS_METADATA, controller)
	);
}

/**
 * The guards one route actually runs under: the controller's chain followed by whatever the handler
 * states of its own, which is the order the guard context creator concatenates them in.
 */
function guardsOfRoute(controller: typeof ApiCallLogController, handler: string): unknown[] {
	const handlers = controller.prototype as unknown as Record<string, object>;
	const declared = Reflect.getMetadata('__guards__', controller) ?? [];
	const restated = Reflect.getMetadata('__guards__', handlers[handler]) ?? [];

	return Array.from(new Set([...declared, ...restated]));
}

/** The permission one resolver field runs under. */
function permissionOfField(field: string): unknown {
	const fields = ApiCallLogResolver.prototype as unknown as Record<string, object>;

	return Reflect.getMetadata(PERMISSIONS_METADATA, fields[field]);
}

describe('ApiCallLogResolver — the SDL declares the capabilities the REST routes serve', () => {
	it('declares the connection query and the removal', () => {
		expect(rootFields('Query')).toEqual(expect.arrayContaining(['apiCallLogs']));
		expect(rootFields('Mutation')).toEqual(expect.arrayContaining(['deleteApiCallLog']));
	});

	it('declares the reads and the writes the controller serves, and no more', () => {
		// The controller declares two routes and inherits nothing, so a count field and a node field
		// would each be a capability with no delivered route behind it.
		expect(ownedRootFields('Query')).toEqual(['apiCallLogs']);
		expect(ownedRootFields('Mutation')).toEqual(['deleteApiCallLog']);
	});

	it('declares the connection, its edges, its filter and its sorts', () => {
		expect(printed).toMatch(
			/type ApiCallLogConnection \{\s*nodes: \[ApiCallLog!\]!\s*edges: \[ApiCallLogEdge!\]!\s*totalCount: Int!\s*pageInfo: PageInfo!\s*\}/
		);
		expect(printed).toMatch(/type ApiCallLogEdge \{\s*node: ApiCallLog!\s*cursor: String!\s*\}/);
		expect(printed).toMatch(/input ApiCallLogFilter \{/);
		expect(printed).toMatch(/input ApiCallLogSort \{/);

		// A payload is a document, not a column an order means anything over, so the sort enum lists
		// none of the three — while the filter does, because the row carries them.
		const sortEnum = printed.match(/enum ApiCallLogSortField \{([\s\S]*?)\n\}/)?.[1] ?? '';
		expect(sortEnum).not.toContain('requestHeaders');
		expect(sortEnum).not.toContain('requestBody');
		expect(sortEnum).not.toContain('responseBody');
	});

	it('carries the documents the reader answers whole', () => {
		expect(printed).toMatch(/type ApiCallLog \{/);
		expect(printed).toMatch(/correlationId: ID!/);
		expect(printed).toMatch(/requestHeaders: JSON!/);
		expect(printed).toMatch(/requestBody: JSON!/);
		expect(printed).toMatch(/responseBody: JSON!/);
		// The reader joins no relation, so the caller is an identifier and never an object.
		expect(printed).toMatch(/userId: ID/);
	});

	it('offers the removal flag as an argument rather than a second field', () => {
		expect(printed).toMatch(/deleteApiCallLog\([^)]*forceDelete: Boolean/);
		// One removal, stated once: a second field for the hard branch would be the same route twice.
		expect(rootFields('Mutation').filter((field) => field.toLowerCase().includes('deleteapicalllog'))).toEqual([
			'deleteApiCallLog'
		]);
	});
});

describe('ApiCallLogResolver — the connection contract', () => {
	it('answers the list with nodes, edges, a total and the boundary cursors', async () => {
		const { resolver, apiCallLogService } = surfaces();

		const connection = await resolver.apiCallLogs(undefined, undefined, undefined, 20);

		// The read is the one the REST list route performs with an empty query string.
		expect(apiCallLogService.findAllLogs).toHaveBeenCalledWith({});
		expect(connection.nodes).toHaveLength(2);
		expect(connection.totalCount).toBe(2);
		expect(connection.pageInfo.startCursor).toBe(connection.edges[0].cursor);
		expect(connection.pageInfo.endCursor).toBe(connection.edges[1].cursor);
		expect(connection.pageInfo.hasNextPage).toBe(false);
		// The cursor is the platform's own codec, so the same cursor is valid on the REST surface.
		expect(CursorCodec.decode(connection.edges[0].cursor).id).toBe(RECENT);
	});

	it('orders most recent request first when the caller states none', async () => {
		const { resolver } = surfaces();

		const connection = await resolver.apiCallLogs();

		expect(connection.nodes.map((node) => node.id)).toEqual([RECENT, OLDER]);
	});

	it('narrows by the fields the filter declares, the correlation identifier included', async () => {
		const { resolver } = surfaces();

		// The whole point of the table: one operation's rows, across every service it touched.
		const byOperation = await resolver.apiCallLogs({ correlationId: { eq: CORRELATION } });
		expect(byOperation.totalCount).toBe(2);

		const byStatus = await resolver.apiCallLogs({ statusCode: { gte: 500 } });
		expect(byStatus.nodes.map((node) => node.id)).toEqual([OLDER]);

		const byMethod = await resolver.apiCallLogs({ method: { eq: 'POST' } });
		expect(byMethod.nodes.map((node) => node.id)).toEqual([RECENT]);

		const byWindow = await resolver.apiCallLogs({
			requestTime: { between: ['2026-02-15T00:00:00.000Z', '2026-03-15T00:00:00.000Z'] }
		});
		expect(byWindow.nodes.map((node) => node.id)).toEqual([RECENT]);

		// A document column narrows through the kernel's own `JSON` operators.
		const byBody = await resolver.apiCallLogs({ responseBody: { contains: ['Internal server error'] } });
		expect(byBody.nodes.map((node) => node.id)).toEqual([OLDER]);
	});

	it('orders by the keys the sort enum offers', async () => {
		const { resolver } = surfaces();

		const byStatus = await resolver.apiCallLogs(undefined, [{ field: 'statusCode', direction: 'ASC' }]);
		expect(byStatus.nodes.map((node) => node.id)).toEqual([RECENT, OLDER]);
	});

	it('resumes a walk from an opaque cursor', async () => {
		const { resolver } = surfaces();
		const first = await resolver.apiCallLogs(undefined, undefined, undefined, 1);

		expect(first.nodes.map((node) => node.id)).toEqual([RECENT]);

		const second = await resolver.apiCallLogs(undefined, undefined, {
			first: 1,
			after: first.pageInfo.endCursor ?? undefined
		});

		expect(second.nodes.map((node) => node.id)).toEqual([OLDER]);
		expect(second.pageInfo.hasPreviousPage).toBe(true);
	});

	it('refuses a sort field the resource does not declare', async () => {
		const { resolver } = surfaces();

		const error = await resolver
			.apiCallLogs(undefined, [{ field: 'requestBody', direction: 'ASC' }] as never)
			.catch((thrown) => thrown);

		expect(isRefusal(error)).toBe(true);
		expect((error as Error).message).toContain('QUERY_SORT_NOT_ALLOWED');
	});

	it('refuses a filter field the resource does not declare', async () => {
		const { resolver } = surfaces();

		const error = await resolver.apiCallLogs({ relations: { eq: 'user' } }).catch((thrown) => thrown);

		expect(isRefusal(error)).toBe(true);
		expect((error as Error).message).toContain('QUERY_UNKNOWN_FILTER_FIELD');
	});

	it('refuses both pagination styles at once rather than silently preferring one', async () => {
		const { resolver } = surfaces();

		const error = await resolver
			.apiCallLogs(undefined, undefined, undefined, 5, undefined, undefined, undefined, 5)
			.catch((thrown) => thrown);

		expect(isRefusal(error)).toBe(true);
		expect((error as Error).message).toContain('QUERY_NESTING_LIMIT_EXCEEDED');
	});
});

describe('ApiCallLogResolver — one concept, two protocols, the same operations', () => {
	it('withdraws a row when the flag is not stated, which is the route’s own default', async () => {
		const { resolver, apiCallLogService } = surfaces();

		expect(await resolver.deleteApiCallLog(RECENT)).toBe(true);
		expect(apiCallLogService.softDelete).toHaveBeenCalledWith(RECENT, {
			where: { forceDelete: false }
		});
		expect(apiCallLogService.delete).not.toHaveBeenCalled();
	});

	it('removes a row outright when the flag is stated', async () => {
		const { resolver, apiCallLogService } = surfaces();

		expect(await resolver.deleteApiCallLog(RECENT, true)).toBe(true);
		expect(apiCallLogService.delete).toHaveBeenCalledWith(RECENT, {
			where: { forceDelete: true }
		});
		expect(apiCallLogService.softDelete).not.toHaveBeenCalled();
	});

	it('surfaces a refusal as a 4xx rather than swallowing it', async () => {
		const { resolver, apiCallLogService } = surfaces();
		const refusal = new Error('API_CALL_LOG_STILL_REFERENCED: the row is held by a retention rule.');

		apiCallLogService.delete.mockRejectedValueOnce(refusal);

		await expect(resolver.deleteApiCallLog(RECENT, true)).rejects.toBe(refusal);
	});
});

describe('ApiCallLogResolver — the guard stack and the permission are the controller’s', () => {
	it('guards the resolver the way the controller is guarded, plus the gate', () => {
		const resolverGuards = Reflect.getMetadata('__guards__', ApiCallLogResolver) ?? [];
		const controllerGuards = Reflect.getMetadata('__guards__', ApiCallLogController) ?? [];

		expect(controllerGuards).toEqual(expect.arrayContaining([TenantPermissionGuard, PermissionGuard]));
		expect(resolverGuards).toEqual(expect.arrayContaining([TenantPermissionGuard, PermissionGuard]));
	});

	it('runs every route under the guard chain the resolver states', () => {
		const stated = Reflect.getMetadata('__guards__', ApiCallLogResolver) ?? [];

		for (const handler of ['findAll', 'deleteById']) {
			expect([...guardsOfRoute(ApiCallLogController, handler), FeatureFlagGuard].sort()).toEqual([...stated].sort());
		}
	});

	it('states on the class the permission the controller states on the class', () => {
		expect(Reflect.getMetadata(PERMISSIONS_METADATA, ApiCallLogResolver)).toEqual(
			Reflect.getMetadata(PERMISSIONS_METADATA, ApiCallLogController)
		);
		expect(Reflect.getMetadata(PERMISSIONS_METADATA, ApiCallLogResolver)).toEqual([
			PermissionsEnum.ALL_ORG_VIEW,
			PermissionsEnum.API_CALL_LOG_READ
		]);
	});

	it('states on every field the permission its own route runs under', () => {
		const routes: Array<[string, string]> = [
			['apiCallLogs', 'findAll'],
			['deleteApiCallLog', 'deleteById']
		];

		const stated = Object.fromEntries(routes.map(([field]) => [field, permissionOfField(field)]));
		const expected = Object.fromEntries(
			routes.map(([field, handler]) => [field, permissionOfRoute(ApiCallLogController, handler)])
		);

		expect(stated).toEqual(expected);
		// Neither route states a permission of its own, so both run under the class's pair — the read
		// permission alone would be narrower than the routes and the pair is what they carry.
		expect(permissionOfField('apiCallLogs')).toEqual([
			PermissionsEnum.ALL_ORG_VIEW,
			PermissionsEnum.API_CALL_LOG_READ
		]);
		expect(permissionOfField('deleteApiCallLog')).toEqual([
			PermissionsEnum.ALL_ORG_VIEW,
			PermissionsEnum.API_CALL_LOG_READ
		]);
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
		getHandler: () => (ApiCallLogResolver.prototype as never)[field],
		getClass: () => ApiCallLogResolver,
		getType: () => 'graphql',
		getArgByIndex: () => ({ fieldName: field })
	} as unknown as ExecutionContext;
}

describe('ApiCallLogResolver — a capability that is switched off is not served', () => {
	it('declares the capability the catalogue declares for this surface, on the class', () => {
		expect(Reflect.getMetadata(FEATURE_METADATA, ApiCallLogResolver)).toBe(FEATURE_GRAPHQL);
		expect(Reflect.getMetadata('__guards__', ApiCallLogResolver)).toContain(FeatureFlagGuard);
	});

	it('refuses a field whose capability is switched off, and names the field it refused', async () => {
		const { guard, featureService } = gate(false);

		const refusal = await guard.canActivate(graphqlContext('apiCallLogs')).catch((thrown) => thrown);

		expect(featureService.isFeatureEnabled).toHaveBeenCalledWith(FEATURE_GRAPHQL);
		expect((refusal as Error).message).toContain('apiCallLogs');
		expect((refusal as { getStatus(): number }).getStatus()).toBe(404);
	});

	it('refuses the removal on the same capability as the read', async () => {
		const { guard } = gate(false);

		const refusal = await guard.canActivate(graphqlContext('deleteApiCallLog')).catch((thrown) => thrown);

		expect((refusal as Error).message).toContain('deleteApiCallLog');
	});

	it('serves the field once the capability is switched on', async () => {
		const { guard } = gate(true);

		await expect(guard.canActivate(graphqlContext('apiCallLogs'))).resolves.toBe(true);
	});
});
