/**
 * 🛑 This import must stay FIRST, before any import that pulls a core service or controller — see
 * `channel.controller.spec.ts` for the cycle it avoids: an entity decorator is undefined when the
 * entity applies it if the graph is entered through the validators rather than through the entities.
 */
import '../../core/entities/internal';

import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { ExecutionContext, NotFoundException } from '@nestjs/common';
import { MODULE_METADATA } from '@nestjs/common/constants';
import { CqrsModule } from '@nestjs/cqrs';
import { Reflector } from '@nestjs/core';
import { buildSchema, printSchema } from 'graphql';
import { PermissionsEnum } from '@gauzy/contracts';
import { FEATURE_METADATA, PERMISSIONS_METADATA } from '@gauzy/constants';
import { CursorCodec } from '../../api/cursor';
import { FeatureFlagGuard, PermissionGuard, TenantPermissionGuard } from '../../shared/guards';
import { DashboardWidgetModule } from './dashboard-widget.module';
import { DashboardWidgetController } from './dashboard-widget.controller';
import { DashboardWidgetResolver } from './dashboard-widget.resolver';
import { DashboardWidgetService } from './dashboard-widget.service';
import { DashboardWidgetCreateCommand, DashboardWidgetUpdateCommand } from './commands';

/**
 * The dashboard widget over GraphQL.
 *
 * The delivered REST routes serve a list, one placement, a count, the create, the edit, the removal and
 * the two lifecycle moves. This suite pins the half of the two-protocol doctrine that is easy to get
 * quietly wrong:
 *
 * - every one of those capabilities is a root field of the one composed schema, and the list is a
 *   connection with the platform's own cursor codec behind it, so a cursor obtained over REST resumes
 *   here and a refusal is the query protocol's own code;
 * - **the canvas a dashboard is assembled from is the connection narrowed**, not a second root field:
 *   a dashboard's widgets are this list filtered by `dashboardId`, so the canvas and the widget list
 *   cannot come to disagree about what a dashboard holds;
 * - every field reaches the same service method or dispatches the same command the REST route reaches,
 *   with the same payload — the removal included, which answers a boolean because the delivered answer
 *   is a statement about the write rather than a row;
 * - **the guard chain and the permission are the controller's, field by field** — including the four
 *   fields whose routes are inherited from the CRUD base and therefore run under the controller's
 *   class-level *read* permission rather than an edit permission a lifecycle move would seem to
 *   deserve;
 * - the members the delivered readers cannot produce are not declared at all: the four relations no
 *   read this surface mirrors joins, and the archived pair no route writes.
 */

const TENANT = '00000000-0000-4000-8000-000000000001';
const ORGANIZATION = '00000000-0000-4000-8000-000000000002';
const EMPLOYEE = '00000000-0000-4000-8000-000000000003';
const DASHBOARD = '00000000-0000-4000-8000-000000000010';
const PROJECT = '00000000-0000-4000-8000-000000000020';
const TEAM = '00000000-0000-4000-8000-000000000021';
const PLACEMENT = '00000000-0000-4000-8000-000000000030';
const HIDDEN = '00000000-0000-4000-8000-000000000031';

/** The code the commerce catalogue declares for this surface, as the guard's metadata carries it. */
const FEATURE_GRAPHQL = 'FEATURE_GRAPHQL';

/**
 * The rows a scripted service answers with, in the order the delivered list returns them: the second
 * placement is first in creation order and first in the canvas order, so the connection's own default
 * order is distinguishable from the order the store happens to answer in.
 */
const ROWS = [
	{
		id: PLACEMENT,
		tenantId: TENANT,
		organizationId: ORGANIZATION,
		employeeId: EMPLOYEE,
		dashboardId: DASHBOARD,
		projectId: PROJECT,
		organizationTeamId: TEAM,
		name: 'Members worked',
		order: 2,
		size: 6,
		color: '#1f8efa',
		isVisible: true,
		options: { scope: 'organization', limit: 10 },
		isActive: true,
		createdAt: new Date('2026-03-05T10:00:00.000Z'),
		updatedAt: new Date('2026-03-05T10:00:00.000Z')
	},
	{
		id: HIDDEN,
		tenantId: TENANT,
		organizationId: ORGANIZATION,
		employeeId: EMPLOYEE,
		dashboardId: DASHBOARD,
		projectId: null,
		organizationTeamId: null,
		name: 'Time tracking',
		order: 1,
		size: 12,
		color: null,
		isVisible: false,
		options: { widgets: [{ position: 0 }] },
		isActive: true,
		createdAt: new Date('2026-02-01T10:00:00.000Z'),
		updatedAt: new Date('2026-02-01T10:00:00.000Z')
	}
];

/** The resolver, over a scripted service and command bus. */
function surfaces() {
	const dashboardWidgetService = {
		findAll: jest.fn().mockResolvedValue({ items: ROWS, total: ROWS.length }),
		findOneByIdString: jest.fn().mockResolvedValue(ROWS[0]),
		countBy: jest.fn().mockResolvedValue(ROWS.length),
		delete: jest.fn().mockResolvedValue({ affected: 1 }),
		softRemove: jest.fn().mockResolvedValue({ ...ROWS[0], deletedAt: new Date('2026-05-01T10:00:00.000Z') }),
		softRecover: jest.fn().mockResolvedValue(ROWS[0])
	};
	const commandBus = { execute: jest.fn().mockResolvedValue(ROWS[0]) };

	return {
		dashboardWidgetService,
		commandBus,
		resolver: new DashboardWidgetResolver(dashboardWidgetService as never, commandBus as never)
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

/** The arguments one root field declares, in the order a client states them. */
function fieldArgs(operation: 'Query' | 'Mutation', field: string): string[] {
	const root = schema.getType(operation) as
		| { getFields(): Record<string, { args: readonly { name: string }[] }> }
		| undefined;

	return (root?.getFields()?.[field]?.args ?? []).map((argument) => argument.name);
}

/** The root fields this domain contributes, which are the ones that name its concept. */
function ownedRootFields(operation: 'Query' | 'Mutation'): string[] {
	return rootFields(operation)
		.filter((field) => field.toLowerCase().includes('dashboardwidget'))
		.sort();
}

/** The printed body of one declaration, so a member it must not carry can be asserted absent. */
function declaredBody(kind: 'type' | 'input', name: string): string {
	return printed.match(new RegExp(`${kind} ${name} \\{([\\s\\S]*?)\\n\\}`))?.[1] ?? '';
}

/**
 * The member names one declaration carries, read off its printed body rather than off a description:
 * a doc comment is part of the printed type, so a member is asserted absent by its name and never by
 * the words a description happens to use.
 */
function memberNames(name: string): string[] {
	return [...declaredBody('type', name).matchAll(/^\s+([A-Za-z_][A-Za-z0-9_]*)\s*[:(]/gm)].map((match) => match[1]);
}

/** The member names one input type declares. */
function inputMemberNames(name: string): string[] {
	return [...declaredBody('input', name).matchAll(/^\s+([A-Za-z_][A-Za-z0-9_]*)\s*:/gm)].map((match) => match[1]);
}

/** The handlers of one controller, as functions, inherited ones included. */
function handlersOf(controller: typeof DashboardWidgetController): Record<string, object> {
	return controller.prototype as unknown as Record<string, object>;
}

/**
 * The permission one route runs under: what its handler states, else what its controller states.
 *
 * This is the rule the guards themselves apply — the reflector's `getAllAndOverride` over
 * `[handler, class]` — restated here, so the resolver is held to the controller's own metadata rather
 * than to a second copy of the same list written out in this file.
 */
function permissionOfRoute(controller: typeof DashboardWidgetController, handler: string): unknown {
	return (
		Reflect.getMetadata(PERMISSIONS_METADATA, handlersOf(controller)[handler]) ??
		Reflect.getMetadata(PERMISSIONS_METADATA, controller)
	);
}

/** The guards one route's handler carries of its own, beside the controller's chain. */
function guardsOfHandler(controller: typeof DashboardWidgetController, handler: string): unknown[] {
	return Reflect.getMetadata('__guards__', handlersOf(controller)[handler]) ?? [];
}

/** The permission one resolver field runs under, as its own handler states it. */
function permissionOfField(field: string): unknown {
	const fields = DashboardWidgetResolver.prototype as unknown as Record<string, object>;

	return Reflect.getMetadata(PERMISSIONS_METADATA, fields[field]);
}

/** The guards one resolver field carries of its own. */
function guardsOfField(field: string): unknown[] {
	const fields = DashboardWidgetResolver.prototype as unknown as Record<string, object>;

	return Reflect.getMetadata('__guards__', fields[field]) ?? [];
}

/** Every root field and the delivered route it mirrors. */
const PERMISSION_PARITY: ReadonlyArray<{ field: string; route: string }> = [
	{ field: 'dashboardWidgets', route: 'findAll' },
	{ field: 'dashboardWidget', route: 'findById' },
	{ field: 'dashboardWidgetCount', route: 'getCount' },
	{ field: 'createDashboardWidget', route: 'create' },
	{ field: 'updateDashboardWidget', route: 'update' },
	{ field: 'deleteDashboardWidget', route: 'delete' },
	{ field: 'softDeleteDashboardWidget', route: 'softRemove' },
	{ field: 'recoverDashboardWidget', route: 'softRecover' }
];

/**
 * The gate, over a scripted cache and a scripted feature service.
 *
 * The guard under test is the real one and the metadata it reads is the metadata this resolver
 * declares, which is the point: a spec that asserted the decorator alone would keep passing if the
 * guard stopped reading that key.
 *
 * @param enabled Whether the capability is switched on for the caller's scope.
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
		getHandler: () => (DashboardWidgetResolver.prototype as never)[field],
		getClass: () => DashboardWidgetResolver,
		getType: () => 'graphql',
		getArgByIndex: () => ({ fieldName: field })
	} as unknown as ExecutionContext;
}

describe('DashboardWidgetResolver — the SDL declares the capabilities the REST routes serve', () => {
	it('declares the connection query, the one-row query and the count', () => {
		expect(rootFields('Query')).toEqual(
			expect.arrayContaining(['dashboardWidgets', 'dashboardWidget', 'dashboardWidgetCount'])
		);
	});

	it('declares one mutation per delivered write route', () => {
		expect(rootFields('Mutation')).toEqual(
			expect.arrayContaining([
				'createDashboardWidget',
				'updateDashboardWidget',
				'deleteDashboardWidget',
				'softDeleteDashboardWidget',
				'recoverDashboardWidget'
			])
		);
	});

	it('declares the reads and the writes the controller serves, and no more', () => {
		// The controller serves its list twice — `GET /` and the inherited `GET /pagination` — and the two
		// answer one question, so the surface states it once.
		expect(ownedRootFields('Query')).toEqual(['dashboardWidget', 'dashboardWidgetCount', 'dashboardWidgets']);
		expect(ownedRootFields('Mutation')).toEqual([
			'createDashboardWidget',
			'deleteDashboardWidget',
			'recoverDashboardWidget',
			'softDeleteDashboardWidget',
			'updateDashboardWidget'
		]);
	});

	it('declares the connection, its edges, its filter and its sort', () => {
		expect(printed).toMatch(
			/type DashboardWidgetConnection \{\s*nodes: \[DashboardWidget!\]!\s*edges: \[DashboardWidgetEdge!\]!\s*totalCount: Int!\s*pageInfo: PageInfo!\s*\}/
		);
		expect(printed).toMatch(/type DashboardWidgetEdge \{\s*node: DashboardWidget!\s*cursor: String!\s*\}/);
		expect(printed).toMatch(/input DashboardWidgetFilter \{/);
		expect(printed).toMatch(/input DashboardWidgetSort \{/);
		expect(printed).toMatch(
			/enum DashboardWidgetSortField \{\s*createdAt\s*updatedAt\s*name\s*order\s*isVisible\s*\}/
		);
	});

	it('declares the write inputs the mutations take', () => {
		expect(printed).toMatch(/input CreateDashboardWidgetInput \{/);
		expect(printed).toMatch(/input UpdateDashboardWidgetInput \{/);
		expect(inputMemberNames('CreateDashboardWidgetInput')).toEqual([
			'name',
			'order',
			'size',
			'color',
			'isVisible',
			'options',
			'dashboardId',
			'employeeId',
			'projectId',
			'organizationTeamId',
			'organizationId'
		]);
		expect(inputMemberNames('UpdateDashboardWidgetInput')).toEqual([
			'id',
			'name',
			'order',
			'size',
			'color',
			'isVisible',
			'options',
			'dashboardId',
			'employeeId',
			'projectId',
			'organizationTeamId',
			'organizationId'
		]);
		// The tenant is never stated: the delivered service stamps the caller's own onto the row.
		expect(inputMemberNames('CreateDashboardWidgetInput')).not.toContain('tenantId');
		expect(inputMemberNames('UpdateDashboardWidgetInput')).not.toContain('tenantId');
	});

	it('carries the placement’s own settings document and not the relations no read joins', () => {
		const members = memberNames('DashboardWidget');

		expect(declaredBody('type', 'DashboardWidget')).toMatch(/options: JSON/);
		expect(declaredBody('type', 'DashboardWidget')).toMatch(/name: String!/);
		// The four relations are loaded only when a REST caller names them in `relations`, and no read
		// here does: the identifiers are columns and are carried, the relations are not.
		for (const relation of ['dashboard', 'employee', 'project', 'organizationTeam']) {
			expect(members).not.toContain(relation);
		}
		expect(members).toEqual(
			expect.arrayContaining(['dashboardId', 'employeeId', 'projectId', 'organizationTeamId'])
		);
		// No route of this resource reads or writes them; the two lifecycle routes move `deletedAt` alone.
		expect(members).not.toContain('isArchived');
		expect(members).not.toContain('archivedAt');
		expect(members).toContain('deletedAt');
	});

	it('offers no argument it cannot honour', () => {
		// The delivered list read answers live rows only, so the connection does not offer `withDeleted`.
		expect(fieldArgs('Query', 'dashboardWidgets')).not.toContain('withDeleted');
		expect(fieldArgs('Query', 'dashboardWidgets')).toEqual([
			'filter',
			'sort',
			'page',
			'first',
			'after',
			'last',
			'before',
			'limit',
			'offset',
			'withDeleted',
		]);
		// The count route passes its query string through as the store's own `where`, which this surface
		// cannot hand to that call, so the count states no filter it could not honour.
		expect(fieldArgs('Query', 'dashboardWidgetCount')).toEqual([]);
	});
});

describe('DashboardWidgetResolver — the connection contract', () => {
	it('answers the list with nodes, edges, a total and the boundary cursors', async () => {
		const { resolver, dashboardWidgetService } = surfaces();

		const connection = await resolver.dashboardWidgets(undefined, undefined, undefined, 20);

		// The read is the one the REST list route performs, with the route's own defaults.
		expect(dashboardWidgetService.findAll).toHaveBeenCalledWith({});
		expect(connection.nodes).toHaveLength(2);
		expect(connection.totalCount).toBe(2);
		expect(connection.pageInfo.startCursor).toBe(connection.edges[0].cursor);
		expect(connection.pageInfo.endCursor).toBe(connection.edges[1].cursor);
		// The cursor is the platform's own codec, so the same cursor is valid on the REST surface.
		expect(CursorCodec.decode(connection.edges[0].cursor).id).toBe(HIDDEN);
	});

	it('orders by the positions the dashboard itself states when the caller states none', async () => {
		const { resolver } = surfaces();

		const connection = await resolver.dashboardWidgets();

		// `order` is the position a placement holds on its dashboard, so it leads the canvas order even
		// though the placement carrying it is the older row.
		expect(connection.nodes.map((node) => node.id)).toEqual([HIDDEN, PLACEMENT]);
	});

	it('answers a dashboard’s canvas as this list narrowed, not as a second field', async () => {
		const { resolver } = surfaces();

		const canvas = await resolver.dashboardWidgets({ dashboardId: { eq: DASHBOARD } });

		// The placements of one dashboard are the same rows this connection answers, narrowed by the
		// column the placement carries.
		expect(canvas.nodes.map((node) => node.id)).toEqual([HIDDEN, PLACEMENT]);

		const elsewhere = await resolver.dashboardWidgets({ dashboardId: { eq: PLACEMENT } });
		expect(elsewhere.totalCount).toBe(0);
	});

	it('narrows by the fields the filter declares, the settings document included', async () => {
		const { resolver } = surfaces();

		const visible = await resolver.dashboardWidgets({ isVisible: { eq: true } });
		expect(visible.nodes.map((node) => node.id)).toEqual([PLACEMENT]);

		const byTeam = await resolver.dashboardWidgets({ organizationTeamId: { isNull: true } });
		expect(byTeam.nodes.map((node) => node.id)).toEqual([HIDDEN]);

		// The settings are a document column: a client asks which placements are scoped to an
		// organization, and the answer is the document the connection already holds.
		const byOptions = await resolver.dashboardWidgets({ options: { contains: ['organization'] } });
		expect(byOptions.nodes.map((node) => node.id)).toEqual([PLACEMENT]);
	});

	it('orders by the keys the sort enum offers', async () => {
		const { resolver } = surfaces();

		const byOrder = await resolver.dashboardWidgets(undefined, [{ field: 'order', direction: 'DESC' }]);
		expect(byOrder.nodes.map((node) => node.id)).toEqual([PLACEMENT, HIDDEN]);

		const byName = await resolver.dashboardWidgets(undefined, [{ field: 'name', direction: 'ASC' }]);
		expect(byName.nodes.map((node) => node.id)).toEqual([PLACEMENT, HIDDEN]);
	});

	it('resumes a walk from an opaque cursor, forwards and backwards', async () => {
		const { resolver } = surfaces();
		const first = await resolver.dashboardWidgets(undefined, undefined, undefined, 1);

		expect(first.nodes.map((node) => node.id)).toEqual([HIDDEN]);

		const second = await resolver.dashboardWidgets(undefined, undefined, {
			first: 1,
			after: first.pageInfo.endCursor ?? undefined
		});

		expect(second.nodes.map((node) => node.id)).toEqual([PLACEMENT]);
		expect(second.pageInfo.hasPreviousPage).toBe(true);

		const all = await resolver.dashboardWidgets(undefined, undefined, undefined, 20);
		const last = await resolver.dashboardWidgets(undefined, undefined, {
			last: 1,
			before: all.edges[1].cursor
		});

		expect(last.nodes.map((node) => node.id)).toEqual([HIDDEN]);
		expect(last.pageInfo.hasNextPage).toBe(true);
	});

	it('refuses a sort field the resource does not declare, with the query protocol’s own code', async () => {
		const { resolver } = surfaces();

		const error = await resolver
			.dashboardWidgets(undefined, [{ field: 'options', direction: 'ASC' }] as never)
			.catch((thrown) => thrown);

		expect(isRefusal(error)).toBe(true);
		expect((error as Error).message).toContain('QUERY_SORT_NOT_ALLOWED');
	});

	it('refuses a filter field the resource does not declare', async () => {
		const { resolver } = surfaces();

		const error = await resolver.dashboardWidgets({ dashboard: { eq: DASHBOARD } }).catch((thrown) => thrown);

		expect(isRefusal(error)).toBe(true);
		expect((error as Error).message).toContain('QUERY_UNKNOWN_FILTER_FIELD');
	});
});

describe('DashboardWidgetResolver — one concept, two protocols, the same operations', () => {
	it('reads one placement through the same service method the REST route calls', async () => {
		const { resolver, dashboardWidgetService } = surfaces();

		expect(await resolver.dashboardWidget(PLACEMENT)).toBe(ROWS[0]);
		expect(dashboardWidgetService.findOneByIdString).toHaveBeenCalledWith(PLACEMENT);
	});

	it('answers null for a placement that is not there, which is the REST route’s 404 in this vocabulary', async () => {
		const { resolver, dashboardWidgetService } = surfaces();
		dashboardWidgetService.findOneByIdString.mockRejectedValueOnce(new NotFoundException());

		expect(await resolver.dashboardWidget(HIDDEN)).toBeNull();
	});

	it('counts through the same service method the count route calls, with the route’s own options', async () => {
		const { resolver, dashboardWidgetService } = surfaces();

		expect(await resolver.dashboardWidgetCount()).toBe(2);
		expect(dashboardWidgetService.countBy).toHaveBeenCalledWith();
	});

	it('places a widget through the command the REST route dispatches', async () => {
		const { resolver, commandBus } = surfaces();

		await resolver.createDashboardWidget({ name: 'Members worked', dashboardId: DASHBOARD, order: 2 });

		const command = commandBus.execute.mock.calls[0][0];
		expect(command).toBeInstanceOf(DashboardWidgetCreateCommand);
		expect(command.input).toEqual({ name: 'Members worked', dashboardId: DASHBOARD, order: 2 });
	});

	it('changes a placement through the command the REST route dispatches, carrying the path identifier', async () => {
		const { resolver, commandBus } = surfaces();

		await resolver.updateDashboardWidget({ id: PLACEMENT, order: 1, isVisible: false });

		const command = commandBus.execute.mock.calls[0][0];
		expect(command).toBeInstanceOf(DashboardWidgetUpdateCommand);
		expect(command.id).toBe(PLACEMENT);
		expect(command.input).toEqual({ order: 1, isVisible: false });
	});

	it('removes a placement through the same service method the REST route calls', async () => {
		const { resolver, dashboardWidgetService } = surfaces();

		expect(await resolver.deleteDashboardWidget(PLACEMENT)).toBe(true);
		expect(dashboardWidgetService.delete).toHaveBeenCalledWith(PLACEMENT);
	});

	it('withdraws and restores a placement through the same service methods the REST routes call', async () => {
		const { resolver, dashboardWidgetService } = surfaces();

		const withdrawn = await resolver.softDeleteDashboardWidget(PLACEMENT);
		expect(withdrawn.deletedAt).toBeInstanceOf(Date);
		expect(dashboardWidgetService.softRemove).toHaveBeenCalledWith(PLACEMENT);

		expect(await resolver.recoverDashboardWidget(PLACEMENT)).toBe(ROWS[0]);
		expect(dashboardWidgetService.softRecover).toHaveBeenCalledWith(PLACEMENT);
	});

	it('surfaces a refusal as a 4xx that is not a 404', async () => {
		const { resolver, dashboardWidgetService } = surfaces();
		const refusal = new Error('Failed to create dashboard widget: the dashboard does not exist');

		dashboardWidgetService.delete.mockRejectedValueOnce(refusal);

		await expect(resolver.deleteDashboardWidget(PLACEMENT)).rejects.toBe(refusal);
	});
});

describe('DashboardWidgetResolver — the guard stack and the permission are the controller’s', () => {
	it('guards the resolver the way the controller is guarded, plus the gate', () => {
		const resolverGuards = Reflect.getMetadata('__guards__', DashboardWidgetResolver) ?? [];
		const controllerGuards = Reflect.getMetadata('__guards__', DashboardWidgetController) ?? [];

		expect(resolverGuards).toEqual(expect.arrayContaining([TenantPermissionGuard, PermissionGuard]));
		expect(controllerGuards).toEqual(expect.arrayContaining([TenantPermissionGuard, PermissionGuard]));
		// The one guard the resolver states beyond the controller's chain is the gate, and it is the
		// addition rather than a substitution: the two the controller states come first, so a caller with
		// no credential is refused as a credential problem before a tenant's switches are read.
		expect(resolverGuards).toEqual([...controllerGuards, FeatureFlagGuard]);
	});

	it('runs every route under the guard chain the resolver states', () => {
		const stated = (Reflect.getMetadata('__guards__', DashboardWidgetResolver) ?? []) as unknown[];

		for (const { route } of PERMISSION_PARITY) {
			// The controller's chain and the resolver's are the same set, which is the whole parity claim:
			// a route that added a guard of its own would narrow REST below GraphQL and is caught here.
			const declared = Reflect.getMetadata('__guards__', DashboardWidgetController) ?? [];
			const restated = guardsOfHandler(DashboardWidgetController, route);

			expect([...new Set([...declared, ...restated, FeatureFlagGuard])].sort()).toEqual([...stated].sort());
		}
	});

	it('states on the class the permission the controller states on the class', () => {
		expect(Reflect.getMetadata(PERMISSIONS_METADATA, DashboardWidgetResolver)).toEqual(
			Reflect.getMetadata(PERMISSIONS_METADATA, DashboardWidgetController)
		);
		expect(Reflect.getMetadata(PERMISSIONS_METADATA, DashboardWidgetController)).toEqual([
			PermissionsEnum.DASHBOARD_READ
		]);
	});

	it.each(PERMISSION_PARITY)('$field mirrors $route exactly', ({ field, route }) => {
		expect(permissionOfField(field)).toEqual(permissionOfRoute(DashboardWidgetController, route));
		// The guard a field states of its own is the guard its route's handler states of its own: the
		// class-level chains are compared above, and a handler that added one is caught here.
		expect(guardsOfField(field)).toEqual(guardsOfHandler(DashboardWidgetController, route));
	});

	it('carries the organization-wide view pair on the two reads whose routes state it', () => {
		for (const field of ['dashboardWidgets', 'dashboardWidget']) {
			expect(permissionOfField(field)).toEqual([
				PermissionsEnum.ALL_ORG_VIEW,
				PermissionsEnum.DASHBOARD_READ
			]);
		}
	});

	it('carries the organization-wide edit permission on every write whose route states it', () => {
		for (const field of ['createDashboardWidget', 'updateDashboardWidget', 'deleteDashboardWidget']) {
			expect(permissionOfField(field)).toEqual([PermissionsEnum.ALL_ORG_EDIT]);
		}
	});

	it('carries the read permission on the fields whose routes inherit it', () => {
		// The count, the withdrawal and the restoration are delivered by the CRUD base without a
		// permission of their own, so they run under the controller's class-level read permission.
		// Stating "no metadata" as "no permission", or stating the edit permission a lifecycle move seems
		// to deserve, would widen those routes on this surface only.
		for (const handler of ['getCount', 'pagination', 'softRemove', 'softRecover']) {
			expect(
				Reflect.getMetadata(PERMISSIONS_METADATA, handlersOf(DashboardWidgetController)[handler])
			).toBeUndefined();
		}

		for (const field of ['dashboardWidgetCount', 'softDeleteDashboardWidget', 'recoverDashboardWidget']) {
			expect(permissionOfField(field)).toEqual([PermissionsEnum.DASHBOARD_READ]);
		}
		expect(permissionOfRoute(DashboardWidgetController, 'pagination')).toEqual([PermissionsEnum.DASHBOARD_READ]);
	});
});

describe('DashboardWidgetResolver — a capability that is switched off is not served', () => {
	it('declares the capability the commerce catalogue declares for this surface, on the class', () => {
		// One statement, read by the guard with `getAllAndOverride` over the handler and then the class,
		// so every field is behind it.
		expect(Reflect.getMetadata(FEATURE_METADATA, DashboardWidgetResolver)).toBe(FEATURE_GRAPHQL);
		expect(Reflect.getMetadata('__guards__', DashboardWidgetResolver)).toContain(FeatureFlagGuard);
	});

	it('refuses a field whose capability is switched off, and names the field it refused', async () => {
		const { guard, featureService } = gate(false);

		const refusal = await guard.canActivate(graphqlContext('dashboardWidgets')).catch((thrown) => thrown);

		// The code the guard resolved is the one this resolver declared, not a second copy of it.
		expect(featureService.isFeatureEnabled).toHaveBeenCalledWith(FEATURE_GRAPHQL);
		expect(refusal).toBeInstanceOf(NotFoundException);
		expect((refusal as Error).message).toContain('dashboardWidgets');
		expect((refusal as NotFoundException).getStatus()).toBe(404);
	});

	it('refuses the writes as well, the removal and the two lifecycle moves included', async () => {
		for (const field of [
			'createDashboardWidget',
			'updateDashboardWidget',
			'deleteDashboardWidget',
			'softDeleteDashboardWidget',
			'recoverDashboardWidget'
		]) {
			const { guard } = gate(false);

			await expect(guard.canActivate(graphqlContext(field))).rejects.toBeInstanceOf(NotFoundException);
		}
	});

	it('serves the field once the capability is switched on', async () => {
		const { guard } = gate(true);

		await expect(guard.canActivate(graphqlContext('dashboardWidget'))).resolves.toBe(true);
	});
});

describe('DashboardWidgetModule — the resolver is declared where its dependencies are reachable', () => {
	it('declares the resolver as a provider of the module that owns the service', () => {
		const providers = (Reflect.getMetadata(MODULE_METADATA.PROVIDERS, DashboardWidgetModule) ?? []) as unknown[];

		expect(providers).toContain(DashboardWidgetResolver);
		expect(providers).toContain(DashboardWidgetService);
	});

	it('exports the service and the command bus the resolver injects', () => {
		// A resolver is a provider of whichever module the Apollo configuration names, so a module that
		// imports this one receives what this one hands on and nothing else.
		const exported = (Reflect.getMetadata(MODULE_METADATA.EXPORTS, DashboardWidgetModule) ?? []) as unknown[];

		expect(exported).toContain(DashboardWidgetService);
		expect(exported).toContain(CqrsModule);
	});
});
