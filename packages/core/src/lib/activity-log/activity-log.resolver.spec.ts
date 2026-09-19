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
import { FEATURE_METADATA, PERMISSIONS_METADATA } from '@gauzy/constants';
import { CursorCodec } from '../api/cursor';
import { FeatureFlagGuard, PermissionGuard, TenantPermissionGuard } from '../shared/guards';
import { ActivityLogController } from './activity-log.controller';
import { ActivityLogResolver } from './activity-log.resolver';

/**
 * The activity log over GraphQL.
 *
 * The delivered controller serves one route — a filtered, paginated read of the log — and inherits
 * nothing, because it does not extend the CRUD base. This suite pins the half of the two-protocol
 * doctrine that is easy to get quietly wrong:
 *
 * - the one capability the route serves is one root field of the composed schema, and the list is a
 *   connection with the platform's own cursor codec behind it;
 * - the read is the same `findActivityLogs` call the route makes, with the same defaults;
 * - **the guard chain is the controller's and the field states the permission its own route runs
 *   under** — which here is an empty list, stated on both the controller and the resolver so the
 *   parity is a decision rather than an omission;
 * - the fields the route does not serve — a count, a single row, any write — are not declared at all.
 */

const TENANT = '00000000-0000-4000-8000-000000000001';
const ORGANIZATION = '00000000-0000-4000-8000-000000000002';
const RECORD = '00000000-0000-4000-8000-000000000010';
const OLDER = '00000000-0000-4000-8000-000000000011';

/** The rows a scripted service answers with, in the order the delivered reader returns them. */
const ROWS = [
	{
		id: RECORD,
		tenantId: TENANT,
		organizationId: ORGANIZATION,
		entity: 'OrganizationProject',
		entityId: '00000000-0000-4000-8000-000000000020',
		action: 'Updated',
		actorType: 'User',
		description: 'Updated project Apartment complex',
		updatedFields: ['name'],
		isActive: true,
		isArchived: false,
		createdAt: new Date('2026-03-01T10:00:00.000Z'),
		updatedAt: new Date('2026-03-01T10:00:00.000Z')
	},
	{
		id: OLDER,
		tenantId: TENANT,
		organizationId: ORGANIZATION,
		entity: 'Task',
		entityId: '00000000-0000-4000-8000-000000000021',
		action: 'Created',
		actorType: 'System',
		description: 'Created task Draft the brief',
		isActive: true,
		isArchived: false,
		createdAt: new Date('2026-02-01T10:00:00.000Z'),
		updatedAt: new Date('2026-02-01T10:00:00.000Z')
	}
];

/** The resolver, over a scripted service. */
function surfaces() {
	const activityLogService = {
		findActivityLogs: jest.fn().mockResolvedValue({ items: ROWS, total: ROWS.length })
	};

	return {
		activityLogService,
		resolver: new ActivityLogResolver(activityLogService as never)
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
		.filter((field) => field.toLowerCase().includes('activitylog'))
		.sort();
}

/** The permission one route runs under: what its handler states, else what its controller states. */
function permissionOfRoute(controller: typeof ActivityLogController, handler: string): unknown {
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
function guardsOfRoute(controller: typeof ActivityLogController, handler: string): unknown[] {
	const handlers = controller.prototype as unknown as Record<string, object>;
	const declared = Reflect.getMetadata('__guards__', controller) ?? [];
	const restated = Reflect.getMetadata('__guards__', handlers[handler]) ?? [];

	return Array.from(new Set([...declared, ...restated]));
}

/** The permission one resolver field runs under. */
function permissionOfField(field: string): unknown {
	const fields = ActivityLogResolver.prototype as unknown as Record<string, object>;

	return Reflect.getMetadata(PERMISSIONS_METADATA, fields[field]);
}

describe('ActivityLogResolver — the SDL declares the capabilities the REST route serves', () => {
	it('declares the connection query', () => {
		expect(rootFields('Query')).toEqual(expect.arrayContaining(['activityLogs']));
	});

	it('declares the read the controller serves, and no more', () => {
		// The controller declares one route and inherits nothing, so the surface is one field: a count,
		// a node read or a write would each be a capability with no delivered route behind it.
		expect(ownedRootFields('Query')).toEqual(['activityLogs']);
		expect(ownedRootFields('Mutation')).toEqual([]);
	});

	it('declares the connection, its edges, its filter and its sorts', () => {
		expect(printed).toMatch(
			/type ActivityLogConnection \{\s*nodes: \[ActivityLog!\]!\s*edges: \[ActivityLogEdge!\]!\s*totalCount: Int!\s*pageInfo: PageInfo!\s*\}/
		);
		expect(printed).toMatch(/type ActivityLogEdge \{\s*node: ActivityLog!\s*cursor: String!\s*\}/);
		expect(printed).toMatch(/input ActivityLogFilter \{/);
		expect(printed).toMatch(/input ActivityLogSort \{/);
		// The order vocabulary is the delivered reader's own allow-list and not a wider one.
		expect(printed).toMatch(/enum ActivityLogSortField \{\s*createdAt\s*updatedAt\s*entity\s*action\s*\}/);
	});

	it('carries the polymorphic pair and the documents the reader answers', () => {
		expect(printed).toMatch(/type ActivityLog \{/);
		expect(printed).toMatch(/entity: String!/);
		expect(printed).toMatch(/entityId: ID!/);
		expect(printed).toMatch(/updatedFields: JSON/);
		expect(printed).toMatch(/data: JSON/);
		// The reader joins no relation, so the author is an identifier and never an object.
		expect(printed).toMatch(/employeeId: ID/);
	});

	it('offers no argument the read cannot honour', () => {
		// The read names no relation, so the route's `relations` list is deliberately not an argument.
		expect(printed).not.toMatch(/activityLogs\([^)]*relations/);
		// The read's own page bounds the set it answers, so `withDeleted` is not offered either: the
		// withdrawn rows are reached through the `deletedAt` filter, which the reader does answer.
		expect(printed).not.toMatch(/activityLogs\([^)]*withDeleted/);
		expect(printed).toMatch(/deletedAt: DateTimeFilter/);
	});
});

describe('ActivityLogResolver — the connection contract', () => {
	it('answers the list with nodes, edges, a total and the boundary cursors', async () => {
		const { resolver, activityLogService } = surfaces();

		const connection = await resolver.activityLogs(undefined, undefined, undefined, 20);

		// The read is the one the REST list route performs with an empty query string.
		expect(activityLogService.findActivityLogs).toHaveBeenCalledWith({});
		expect(connection.nodes).toHaveLength(2);
		expect(connection.totalCount).toBe(2);
		expect(connection.pageInfo.startCursor).toBe(connection.edges[0].cursor);
		expect(connection.pageInfo.endCursor).toBe(connection.edges[1].cursor);
		expect(connection.pageInfo.hasNextPage).toBe(false);
		// The cursor is the platform's own codec, so the same cursor is valid on the REST surface.
		expect(CursorCodec.decode(connection.edges[0].cursor).id).toBe(RECORD);
	});

	it('orders newest first when the caller states none, which is the reader’s own default', async () => {
		const { resolver } = surfaces();

		const connection = await resolver.activityLogs();

		expect(connection.nodes.map((node) => node.id)).toEqual([RECORD, OLDER]);
	});

	it('narrows by the fields the filter declares, including the polymorphic pair', async () => {
		const { resolver } = surfaces();

		const byAction = await resolver.activityLogs({ action: { eq: 'Created' } });
		expect(byAction.nodes.map((node) => node.id)).toEqual([OLDER]);

		const byEntity = await resolver.activityLogs({ entity: { eq: 'Task' } });
		expect(byEntity.nodes.map((node) => node.id)).toEqual([OLDER]);

		const byActor = await resolver.activityLogs({ actorType: { in: ['User'] } });
		expect(byActor.nodes.map((node) => node.id)).toEqual([RECORD]);

		// The document members are narrowable through the kernel's own `JSON` operators.
		const byUpdatedField = await resolver.activityLogs({ updatedFields: { contains: ['name'] } });
		expect(byUpdatedField.nodes.map((node) => node.id)).toEqual([RECORD]);
	});

	it('orders by the keys the sort enum offers', async () => {
		const { resolver } = surfaces();

		const ascending = await resolver.activityLogs(undefined, [{ field: 'createdAt', direction: 'ASC' }]);
		expect(ascending.nodes.map((node) => node.id)).toEqual([OLDER, RECORD]);

		const byAction = await resolver.activityLogs(undefined, [{ field: 'action', direction: 'ASC' }]);
		expect(byAction.nodes.map((node) => node.id)).toEqual([OLDER, RECORD]);
	});

	it('resumes a walk from an opaque cursor', async () => {
		const { resolver } = surfaces();
		const first = await resolver.activityLogs(undefined, undefined, undefined, 1);

		expect(first.nodes.map((node) => node.id)).toEqual([RECORD]);

		const second = await resolver.activityLogs(undefined, undefined, {
			first: 1,
			after: first.pageInfo.endCursor ?? undefined
		});

		expect(second.nodes.map((node) => node.id)).toEqual([OLDER]);
		expect(second.pageInfo.hasPreviousPage).toBe(true);
	});

	it('refuses a sort field the resource does not declare, with the query protocol’s own code', async () => {
		const { resolver } = surfaces();

		const error = await resolver
			.activityLogs(undefined, [{ field: 'actorType', direction: 'ASC' }] as never)
			.catch((thrown) => thrown);

		expect(isRefusal(error)).toBe(true);
		expect((error as Error).message).toContain('QUERY_SORT_NOT_ALLOWED');
	});

	it('refuses a filter field the resource does not declare', async () => {
		const { resolver } = surfaces();

		const error = await resolver.activityLogs({ relations: { eq: 'employee' } }).catch((thrown) => thrown);

		expect(isRefusal(error)).toBe(true);
		expect((error as Error).message).toContain('QUERY_UNKNOWN_FILTER_FIELD');
	});

	it('refuses both pagination styles at once rather than silently preferring one', async () => {
		const { resolver } = surfaces();

		const error = await resolver
			.activityLogs(undefined, undefined, undefined, 5, undefined, undefined, undefined, 5)
			.catch((thrown) => thrown);

		expect(isRefusal(error)).toBe(true);
		expect((error as Error).message).toContain('QUERY_NESTING_LIMIT_EXCEEDED');
	});
});

describe('ActivityLogResolver — the guard stack and the permission are the controller’s', () => {
	it('guards the resolver the way the controller is guarded, plus the gate', () => {
		const resolverGuards = Reflect.getMetadata('__guards__', ActivityLogResolver) ?? [];
		const controllerGuards = Reflect.getMetadata('__guards__', ActivityLogController) ?? [];

		expect(controllerGuards).toEqual(expect.arrayContaining([TenantPermissionGuard, PermissionGuard]));
		expect(resolverGuards).toEqual(expect.arrayContaining([TenantPermissionGuard, PermissionGuard]));
	});

	it('runs its route under the guard chain the resolver states', () => {
		const stated = Reflect.getMetadata('__guards__', ActivityLogResolver) ?? [];

		expect([...guardsOfRoute(ActivityLogController, 'getActivityLogs'), FeatureFlagGuard].sort()).toEqual(
			[...stated].sort()
		);
	});

	it('states the empty permission list on the class, exactly as the controller states it', () => {
		// An empty `@Permissions()` is a decision — "no permission required" — and the parity is that
		// both surfaces state it rather than that both happen to leave it out.
		expect(Reflect.getMetadata(PERMISSIONS_METADATA, ActivityLogController)).toEqual([]);
		expect(Reflect.getMetadata(PERMISSIONS_METADATA, ActivityLogResolver)).toEqual([]);
	});

	it('states on every field the permission its own route runs under', () => {
		const routes: Array<[string, string]> = [['activityLogs', 'getActivityLogs']];

		const stated = Object.fromEntries(routes.map(([field]) => [field, permissionOfField(field)]));
		const expected = Object.fromEntries(
			routes.map(([field, handler]) => [field, permissionOfRoute(ActivityLogController, handler)])
		);

		expect(stated).toEqual(expected);
		expect(permissionOfField('activityLogs')).toEqual([]);
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
		getHandler: () => (ActivityLogResolver.prototype as never)[field],
		getClass: () => ActivityLogResolver,
		getType: () => 'graphql',
		getArgByIndex: () => ({ fieldName: field })
	} as unknown as ExecutionContext;
}

describe('ActivityLogResolver — a capability that is switched off is not served', () => {
	it('declares the capability the catalogue declares for this surface, on the class', () => {
		// One statement, read by the guard with `getAllAndOverride` over the handler and then the class,
		// so the field is behind it.
		expect(Reflect.getMetadata(FEATURE_METADATA, ActivityLogResolver)).toBe(FEATURE_GRAPHQL);
		expect(Reflect.getMetadata('__guards__', ActivityLogResolver)).toContain(FeatureFlagGuard);
	});

	it('refuses a field whose capability is switched off, and names the field it refused', async () => {
		const { guard, featureService } = gate(false);

		const refusal = await guard.canActivate(graphqlContext('activityLogs')).catch((thrown) => thrown);

		// The code the guard resolved is the one this resolver declared, not a second copy of it.
		expect(featureService.isFeatureEnabled).toHaveBeenCalledWith(FEATURE_GRAPHQL);
		expect(refusal).toBeInstanceOf(Error);
		// A disabled capability answers the way a missing one does, and says which field was refused.
		expect((refusal as Error).message).toContain('activityLogs');
		expect((refusal as { getStatus(): number }).getStatus()).toBe(404);
	});

	it('serves the field once the capability is switched on', async () => {
		const { guard } = gate(true);

		await expect(guard.canActivate(graphqlContext('activityLogs'))).resolves.toBe(true);
	});
});
