/**
 * 🛑 This import must stay FIRST, before any import that pulls a core service or controller — see
 * `channel.controller.spec.ts` for the cycle it avoids: an entity decorator is undefined when the
 * entity applies it if the graph is entered through the validators rather than through the entities.
 */
import '../core/entities/internal';

import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { ExecutionContext, NotFoundException } from '@nestjs/common';
import { MODULE_METADATA } from '@nestjs/common/constants';
import { CqrsModule } from '@nestjs/cqrs';
import { Reflector } from '@nestjs/core';
import { buildSchema, printSchema } from 'graphql';
import { PermissionsEnum } from '@gauzy/contracts';
import { FEATURE_METADATA, PERMISSIONS_METADATA } from '@gauzy/constants';
import { CursorCodec } from '../api/cursor';
import { FeatureFlagGuard, PermissionGuard, TenantPermissionGuard } from '../shared/guards';
import { DashboardModule } from './dashboard.module';
import { DashboardController } from './dashboard.controller';
import { DashboardResolver } from './dashboard.resolver';
import { DashboardService } from './dashboard.service';
import { DashboardCreateCommand, DashboardUpdateCommand } from './commands';

/**
 * The dashboard over GraphQL.
 *
 * The delivered REST routes serve a list, one dashboard, a count, the create, the edit, the removal and
 * the two lifecycle moves. This suite pins the half of the two-protocol doctrine that is easy to get
 * quietly wrong:
 *
 * - every one of those capabilities is a root field of the one composed schema, and the list is a
 *   connection with the platform's own cursor codec behind it, so a cursor obtained over REST resumes
 *   here and a refusal is the query protocol's own code;
 * - every field reaches the same service method or dispatches the same command the REST route reaches,
 *   with the same payload — the removal included, which answers a boolean because the delivered answer
 *   is a statement about the write rather than a row;
 * - **the guard chain and the permission are the controller's, field by field** — including the four
 *   fields whose routes are inherited from the CRUD base and therefore run under the controller's
 *   class-level *read* permission rather than an edit permission a lifecycle move would seem to
 *   deserve;
 * - the members the delivered readers cannot produce are not declared at all: the widget collection no
 *   read this surface mirrors joins, and the archived pair no route writes;
 * - **the whole surface is behind the capability the catalogue declares for GraphQL**, so a tenant
 *   that switched that capability off is refused the way a disabled capability's routes are — and the
 *   refusal names the field, because the guard reads a GraphQL execution context rather than crashing
 *   on one.
 */

const TENANT = '00000000-0000-4000-8000-000000000001';
const ORGANIZATION = '00000000-0000-4000-8000-000000000002';
const EMPLOYEE = '00000000-0000-4000-8000-000000000003';
const CREATOR = '00000000-0000-4000-8000-000000000004';
const LAYOUT = '00000000-0000-4000-8000-000000000010';
const OTHER = '00000000-0000-4000-8000-000000000011';

/** The code the commerce catalogue declares for this surface, as the guard's metadata carries it. */
const FEATURE_GRAPHQL = 'FEATURE_GRAPHQL';

/**
 * The rows a scripted service answers with: the freshly built arrangement first in creation order and
 * the person's default second, so the connection's own default order is distinguishable from the order
 * the store happens to answer in.
 */
const ROWS = [
	{
		id: LAYOUT,
		tenantId: TENANT,
		organizationId: ORGANIZATION,
		employeeId: EMPLOYEE,
		createdByUserId: CREATOR,
		name: 'Release board',
		identifier: 'release-board',
		description: 'What the team shipped',
		contentHtml: { version: 2, tabs: [{ id: 'tab-1', name: 'Overview', order: 0, widgets: [] }] },
		isDefault: false,
		isActive: true,
		createdAt: new Date('2026-03-05T10:00:00.000Z'),
		updatedAt: new Date('2026-03-05T10:00:00.000Z')
	},
	{
		id: OTHER,
		tenantId: TENANT,
		organizationId: ORGANIZATION,
		employeeId: EMPLOYEE,
		createdByUserId: CREATOR,
		name: 'My week',
		identifier: 'my-week',
		description: 'The work in flight',
		contentHtml: { widgets: [{ position: 0, title: 'Time tracking' }] },
		isDefault: true,
		isActive: true,
		createdAt: new Date('2026-02-01T10:00:00.000Z'),
		updatedAt: new Date('2026-02-01T10:00:00.000Z')
	}
];

/** The resolver, over a scripted service and command bus. */
function surfaces() {
	const dashboardService = {
		findAll: jest.fn().mockResolvedValue({ items: ROWS, total: ROWS.length }),
		findOneByIdString: jest.fn().mockResolvedValue(ROWS[0]),
		countBy: jest.fn().mockResolvedValue(ROWS.length),
		delete: jest.fn().mockResolvedValue({ affected: 1 }),
		softRemove: jest.fn().mockResolvedValue({ ...ROWS[0], deletedAt: new Date('2026-05-01T10:00:00.000Z') }),
		softRecover: jest.fn().mockResolvedValue(ROWS[0])
	};
	const commandBus = { execute: jest.fn().mockResolvedValue(ROWS[0]) };

	return {
		dashboardService,
		commandBus,
		resolver: new DashboardResolver(dashboardService as never, commandBus as never)
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

/** The arguments one root field declares, in the order a client states them. */
function fieldArgs(operation: 'Query' | 'Mutation', field: string): string[] {
	const root = schema.getType(operation) as
		| { getFields(): Record<string, { args: readonly { name: string }[] }> }
		| undefined;

	return (root?.getFields()?.[field]?.args ?? []).map((argument) => argument.name);
}

/**
 * The root fields this domain contributes, which are the ones that name its concept.
 *
 * The widget is the sibling resource's concept: it has its own controller, its own routes and its own
 * resolver, so it is excluded here — one resource's suite asserts its own fields, not its neighbour's.
 */
function ownedRootFields(operation: 'Query' | 'Mutation'): string[] {
	return rootFields(operation)
		.filter((field) => field.toLowerCase().includes('dashboard'))
		.filter((field) => !field.toLowerCase().includes('dashboardwidget'))
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
function handlersOf(controller: typeof DashboardController): Record<string, object> {
	return controller.prototype as unknown as Record<string, object>;
}

/**
 * The permission one route runs under: what its handler states, else what its controller states.
 *
 * This is the rule the guards themselves apply — the reflector's `getAllAndOverride` over
 * `[handler, class]` — restated here, so the resolver is held to the controller's own metadata rather
 * than to a second copy of the same list written out in this file.
 */
function permissionOfRoute(controller: typeof DashboardController, handler: string): unknown {
	return (
		Reflect.getMetadata(PERMISSIONS_METADATA, handlersOf(controller)[handler]) ??
		Reflect.getMetadata(PERMISSIONS_METADATA, controller)
	);
}

/** The guards one route's handler carries of its own, beside the controller's chain. */
function guardsOfHandler(controller: typeof DashboardController, handler: string): unknown[] {
	return Reflect.getMetadata('__guards__', handlersOf(controller)[handler]) ?? [];
}

/** The permission one resolver field runs under, as its own handler states it. */
function permissionOfField(field: string): unknown {
	const fields = DashboardResolver.prototype as unknown as Record<string, object>;

	return Reflect.getMetadata(PERMISSIONS_METADATA, fields[field]);
}

/** The guards one resolver field carries of its own. */
function guardsOfField(field: string): unknown[] {
	const fields = DashboardResolver.prototype as unknown as Record<string, object>;

	return Reflect.getMetadata('__guards__', fields[field]) ?? [];
}

/**
 * Every root field and the delivered route it mirrors.
 *
 * The two surfaces are one capability stated twice, so the guard stack and the permission of a field
 * are read from the field and from the route's own metadata and compared, rather than restated here: a
 * table of permission names would agree with the resolver while disagreeing with the controller, which
 * is the failure this half of the doctrine exists to catch.
 */
const PERMISSION_PARITY: ReadonlyArray<{ field: string; route: string }> = [
	{ field: 'dashboards', route: 'findAll' },
	{ field: 'dashboard', route: 'findById' },
	{ field: 'dashboardCount', route: 'getCount' },
	{ field: 'createDashboard', route: 'create' },
	{ field: 'updateDashboard', route: 'update' },
	{ field: 'deleteDashboard', route: 'delete' },
	{ field: 'softDeleteDashboard', route: 'softRemove' },
	{ field: 'recoverDashboard', route: 'softRecover' }
];

/** The fields whose routes state the organization-wide pair, which the class-level read alone would not. */
const ORGANIZATION_SCOPED = ['dashboards', 'dashboard'];

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
		getHandler: () => (DashboardResolver.prototype as never)[field],
		getClass: () => DashboardResolver,
		getType: () => 'graphql',
		getArgByIndex: () => ({ fieldName: field })
	} as unknown as ExecutionContext;
}

describe('DashboardResolver — the SDL declares the capabilities the REST routes serve', () => {
	it('declares the connection query, the one-row query and the count', () => {
		expect(rootFields('Query')).toEqual(expect.arrayContaining(['dashboards', 'dashboard', 'dashboardCount']));
	});

	it('declares one mutation per delivered write route', () => {
		expect(rootFields('Mutation')).toEqual(
			expect.arrayContaining([
				'createDashboard',
				'updateDashboard',
				'deleteDashboard',
				'softDeleteDashboard',
				'recoverDashboard'
			])
		);
	});

	it('declares the reads and the writes the controller serves, and no more', () => {
		// The controller serves its list twice — `GET /` and the inherited `GET /pagination` — and the
		// two answer one question, so the surface states it once. The widget's own fields are the sibling
		// resource's and are asserted by its own suite.
		expect(ownedRootFields('Query')).toEqual(['dashboard', 'dashboardCount', 'dashboards']);
		expect(ownedRootFields('Mutation')).toEqual([
			'createDashboard',
			'deleteDashboard',
			'recoverDashboard',
			'softDeleteDashboard',
			'updateDashboard'
		]);
	});

	it('declares the connection, its edges, its filter and its sort', () => {
		expect(printed).toMatch(
			/type DashboardConnection \{\s*nodes: \[Dashboard!\]!\s*edges: \[DashboardEdge!\]!\s*totalCount: Int!\s*pageInfo: PageInfo!\s*\}/
		);
		expect(printed).toMatch(/type DashboardEdge \{\s*node: Dashboard!\s*cursor: String!\s*\}/);
		expect(printed).toMatch(/input DashboardFilter \{/);
		expect(printed).toMatch(/input DashboardSort \{/);
		expect(printed).toMatch(
			/enum DashboardSortField \{\s*createdAt\s*updatedAt\s*name\s*identifier\s*isDefault\s*\}/
		);
	});

	it('declares the write inputs the mutations take', () => {
		expect(printed).toMatch(/input CreateDashboardInput \{/);
		expect(printed).toMatch(/input UpdateDashboardInput \{/);
		// Creation never promotes a dashboard — the delivered create DTO omits the member — while the
		// update re-allows it, which is the one asymmetry between the two inputs.
		expect(inputMemberNames('CreateDashboardInput')).toEqual([
			'name',
			'identifier',
			'description',
			'contentHtml',
			'employeeId',
			'organizationId'
		]);
		expect(inputMemberNames('UpdateDashboardInput')).toEqual([
			'id',
			'name',
			'identifier',
			'description',
			'contentHtml',
			'isDefault',
			'employeeId',
			'organizationId'
		]);
		// The tenant is never stated: the delivered service stamps the caller's own onto the row.
		expect(inputMemberNames('CreateDashboardInput')).not.toContain('tenantId');
		expect(inputMemberNames('UpdateDashboardInput')).not.toContain('tenantId');
	});

	it('carries the layout as a document and not the widget collection no read joins', () => {
		const members = memberNames('Dashboard');

		expect(declaredBody('type', 'Dashboard')).toMatch(/contentHtml: JSON/);
		expect(declaredBody('type', 'Dashboard')).toMatch(/name: String!/);
		expect(declaredBody('type', 'Dashboard')).toMatch(/identifier: String!/);
		// The relation is loaded only when a REST caller names it in `relations`, and no read here does:
		// the widgets are the sibling resolver's resource, narrowed by `dashboardId`.
		expect(members).not.toContain('widgets');
		// No route of this resource reads or writes them; the two lifecycle routes move `deletedAt` alone.
		expect(members).not.toContain('isArchived');
		expect(members).not.toContain('archivedAt');
		// The ownership refusals are about this column, so a client that receives one can see what it is
		// about.
		expect(members).toContain('createdByUserId');
		expect(members).toContain('deletedAt');
	});

	it('offers no argument it cannot honour', () => {
		// The delivered list read answers live rows only, so the connection does not offer `withDeleted`.
		expect(fieldArgs('Query', 'dashboards')).not.toContain('withDeleted');
		// The count route passes its query string through as the store's own `where`, which this surface
		// cannot hand to that call, so the count states no filter it could not honour.
		expect(fieldArgs('Query', 'dashboardCount')).toEqual([]);
	});
});

describe('DashboardResolver — the connection contract', () => {
	it('answers the list with nodes, edges, a total and the boundary cursors', async () => {
		const { resolver, dashboardService } = surfaces();

		const connection = await resolver.dashboards(undefined, undefined, undefined, 20);

		// The read is the one the REST list route performs, with the route's own defaults.
		expect(dashboardService.findAll).toHaveBeenCalledWith({});
		expect(connection.nodes).toHaveLength(2);
		expect(connection.totalCount).toBe(2);
		expect(connection.pageInfo.startCursor).toBe(connection.edges[0].cursor);
		expect(connection.pageInfo.endCursor).toBe(connection.edges[1].cursor);
		// The cursor is the platform's own codec, so the same cursor is valid on the REST surface.
		expect(CursorCodec.decode(connection.edges[0].cursor).id).toBe(OTHER);
	});

	it('answers the default dashboard first when the caller states no order', async () => {
		const { resolver } = surfaces();

		const connection = await resolver.dashboards();

		// The default is the one the caller's session opens in, so it leads the list the switcher reads,
		// even though it is the older row.
		expect(connection.nodes.map((node) => node.id)).toEqual([OTHER, LAYOUT]);
	});

	it('narrows by the fields the filter declares, the layout document included', async () => {
		const { resolver } = surfaces();

		const byIdentifier = await resolver.dashboards({ identifier: { eq: 'release-board' } });
		expect(byIdentifier.nodes.map((node) => node.id)).toEqual([LAYOUT]);

		const byOwner = await resolver.dashboards({ createdByUserId: { eq: CREATOR } });
		expect(byOwner.totalCount).toBe(2);

		// The layout is a document column: a client asks which dashboards place a widget, and the answer
		// is the document the connection already holds.
		const byLayout = await resolver.dashboards({ contentHtml: { contains: ['Time tracking'] } });
		expect(byLayout.nodes.map((node) => node.id)).toEqual([OTHER]);

		const byDefault = await resolver.dashboards({ isDefault: { eq: true } });
		expect(byDefault.nodes.map((node) => node.id)).toEqual([OTHER]);
	});

	it('orders by the keys the sort enum offers', async () => {
		const { resolver } = surfaces();

		const newest = await resolver.dashboards(undefined, [{ field: 'createdAt', direction: 'DESC' }]);
		expect(newest.nodes.map((node) => node.id)).toEqual([LAYOUT, OTHER]);

		const byName = await resolver.dashboards(undefined, [{ field: 'name', direction: 'ASC' }]);
		expect(byName.nodes.map((node) => node.id)).toEqual([OTHER, LAYOUT]);
	});

	it('resumes a walk from an opaque cursor, forwards and backwards', async () => {
		const { resolver } = surfaces();
		const first = await resolver.dashboards(undefined, undefined, undefined, 1);

		expect(first.nodes.map((node) => node.id)).toEqual([OTHER]);

		const second = await resolver.dashboards(undefined, undefined, {
			first: 1,
			after: first.pageInfo.endCursor ?? undefined
		});

		expect(second.nodes.map((node) => node.id)).toEqual([LAYOUT]);
		expect(second.pageInfo.hasPreviousPage).toBe(true);

		const all = await resolver.dashboards(undefined, undefined, undefined, 20);
		const last = await resolver.dashboards(undefined, undefined, {
			last: 1,
			before: all.edges[1].cursor
		});

		expect(last.nodes.map((node) => node.id)).toEqual([OTHER]);
		expect(last.pageInfo.hasNextPage).toBe(true);
	});

	it('refuses a sort field the resource does not declare, with the query protocol’s own code', async () => {
		const { resolver } = surfaces();

		const error = await resolver
			.dashboards(undefined, [{ field: 'contentHtml', direction: 'ASC' }] as never)
			.catch((thrown) => thrown);

		expect(isRefusal(error)).toBe(true);
		expect((error as Error).message).toContain('QUERY_SORT_NOT_ALLOWED');
	});

	it('refuses a filter field the resource does not declare', async () => {
		const { resolver } = surfaces();

		const error = await resolver.dashboards({ widgets: { eq: LAYOUT } }).catch((thrown) => thrown);

		expect(isRefusal(error)).toBe(true);
		expect((error as Error).message).toContain('QUERY_UNKNOWN_FILTER_FIELD');
	});

	it('refuses both pagination styles at once rather than silently preferring one', async () => {
		const { resolver } = surfaces();

		const error = await resolver
			.dashboards(undefined, undefined, undefined, 5, undefined, undefined, undefined, 5)
			.catch((thrown) => thrown);

		expect(isRefusal(error)).toBe(true);
		expect((error as Error).message).toContain('QUERY_NESTING_LIMIT_EXCEEDED');
	});
});

describe('DashboardResolver — one concept, two protocols, the same operations', () => {
	it('reads one dashboard through the same service method the REST route calls', async () => {
		const { resolver, dashboardService } = surfaces();

		expect(await resolver.dashboard(LAYOUT)).toBe(ROWS[0]);
		expect(dashboardService.findOneByIdString).toHaveBeenCalledWith(LAYOUT);
	});

	it('answers null for a dashboard that is not there, which is the REST route’s 404 in this vocabulary', async () => {
		const { resolver, dashboardService } = surfaces();
		dashboardService.findOneByIdString.mockRejectedValueOnce(new NotFoundException());

		expect(await resolver.dashboard(OTHER)).toBeNull();
	});

	it('counts through the same service method the count route calls, with the route’s own options', async () => {
		const { resolver, dashboardService } = surfaces();

		expect(await resolver.dashboardCount()).toBe(2);
		expect(dashboardService.countBy).toHaveBeenCalledWith();
	});

	it('creates a dashboard through the command the REST route dispatches', async () => {
		const { resolver, commandBus } = surfaces();

		await resolver.createDashboard({ name: 'Release board', identifier: 'release-board' });

		const command = commandBus.execute.mock.calls[0][0];
		expect(command).toBeInstanceOf(DashboardCreateCommand);
		expect(command.input).toEqual({ name: 'Release board', identifier: 'release-board' });
	});

	it('changes a dashboard through the command the REST route dispatches, carrying the path identifier', async () => {
		const { resolver, commandBus } = surfaces();

		await resolver.updateDashboard({ id: LAYOUT, name: 'Release board v2', isDefault: true });

		const command = commandBus.execute.mock.calls[0][0];
		expect(command).toBeInstanceOf(DashboardUpdateCommand);
		expect(command.id).toBe(LAYOUT);
		expect(command.input).toEqual({ name: 'Release board v2', isDefault: true });
	});

	it('removes a dashboard through the same service method the REST route calls', async () => {
		const { resolver, dashboardService } = surfaces();

		expect(await resolver.deleteDashboard(LAYOUT)).toBe(true);
		expect(dashboardService.delete).toHaveBeenCalledWith(LAYOUT);
	});

	it('withdraws and restores a dashboard through the same service methods the REST routes call', async () => {
		const { resolver, dashboardService } = surfaces();

		const withdrawn = await resolver.softDeleteDashboard(LAYOUT);
		expect(withdrawn.deletedAt).toBeInstanceOf(Date);
		expect(dashboardService.softRemove).toHaveBeenCalledWith(LAYOUT);

		expect(await resolver.recoverDashboard(LAYOUT)).toBe(ROWS[0]);
		expect(dashboardService.softRecover).toHaveBeenCalledWith(LAYOUT);
	});

	it('surfaces the service’s ownership refusal as a 4xx that is not a 404', async () => {
		const { resolver, dashboardService } = surfaces();
		const refusal = new Error('You can only manage your own dashboards');

		dashboardService.delete.mockRejectedValueOnce(refusal);

		await expect(resolver.deleteDashboard(LAYOUT)).rejects.toBe(refusal);
	});
});

describe('DashboardResolver — the guard stack and the permission are the controller’s', () => {
	it('guards the resolver the way the controller is guarded, plus the gate', () => {
		const resolverGuards = Reflect.getMetadata('__guards__', DashboardResolver) ?? [];
		const controllerGuards = Reflect.getMetadata('__guards__', DashboardController) ?? [];

		expect(resolverGuards).toEqual(expect.arrayContaining([TenantPermissionGuard, PermissionGuard]));
		expect(controllerGuards).toEqual(expect.arrayContaining([TenantPermissionGuard, PermissionGuard]));
		// The one guard the resolver states beyond the controller's chain is the gate, and it is the
		// addition rather than a substitution: the two the controller states come first, so a caller with
		// no credential is refused as a credential problem before a tenant's switches are read.
		expect(resolverGuards).toEqual([...controllerGuards, FeatureFlagGuard]);
	});

	it('runs every route under the guard chain the resolver states', () => {
		const stated = (Reflect.getMetadata('__guards__', DashboardResolver) ?? []) as unknown[];

		for (const { route } of PERMISSION_PARITY) {
			// The controller's chain and the resolver's are the same set, which is the whole parity claim:
			// a route that added a guard of its own would narrow REST below GraphQL and is caught here.
			const declared = Reflect.getMetadata('__guards__', DashboardController) ?? [];
			const restated = guardsOfHandler(DashboardController, route);

			expect([...new Set([...declared, ...restated, FeatureFlagGuard])].sort()).toEqual([...stated].sort());
		}
	});

	it('states on the class the permission the controller states on the class', () => {
		expect(Reflect.getMetadata(PERMISSIONS_METADATA, DashboardResolver)).toEqual(
			Reflect.getMetadata(PERMISSIONS_METADATA, DashboardController)
		);
		expect(Reflect.getMetadata(PERMISSIONS_METADATA, DashboardController)).toEqual([
			PermissionsEnum.DASHBOARD_READ
		]);
	});

	it.each(PERMISSION_PARITY)('$field mirrors $route exactly', ({ field, route }) => {
		expect(permissionOfField(field)).toEqual(permissionOfRoute(DashboardController, route));
		// The guard a field states of its own is the guard its route's handler states of its own: the
		// class-level chains are compared above, and a handler that added one is caught here.
		expect(guardsOfField(field)).toEqual(guardsOfHandler(DashboardController, route));
	});

	it('carries the organization-wide pair on the two reads whose routes state it', () => {
		for (const field of ORGANIZATION_SCOPED) {
			expect(permissionOfField(field)).toEqual([
				PermissionsEnum.ALL_ORG_VIEW,
				PermissionsEnum.DASHBOARD_READ
			]);
		}
	});

	it('carries the read permission on the four fields whose routes inherit it', () => {
		// The count, the withdrawal and the restoration are delivered by the CRUD base without a
		// permission of their own, so they run under the controller's class-level read permission.
		// Stating "no metadata" as "no permission", or stating the edit permission a lifecycle move seems
		// to deserve, would widen those routes on this surface only.
		for (const handler of ['getCount', 'pagination', 'softRemove', 'softRecover']) {
			expect(Reflect.getMetadata(PERMISSIONS_METADATA, handlersOf(DashboardController)[handler])).toBeUndefined();
		}

		for (const field of ['dashboardCount', 'softDeleteDashboard', 'recoverDashboard']) {
			expect(permissionOfField(field)).toEqual([PermissionsEnum.DASHBOARD_READ]);
		}
		// The paginated spelling of the list is the same capability as the connection and inherits the
		// same read permission, which is why the connection does not mirror it as a second field.
		expect(permissionOfRoute(DashboardController, 'pagination')).toEqual([PermissionsEnum.DASHBOARD_READ]);
	});

	it('carries the organization-wide edit pair on every write whose route states it', () => {
		const writes: Array<[string, PermissionsEnum]> = [
			['createDashboard', PermissionsEnum.DASHBOARD_CREATE],
			['updateDashboard', PermissionsEnum.DASHBOARD_UPDATE],
			['deleteDashboard', PermissionsEnum.DASHBOARD_DELETE]
		];

		for (const [field, permission] of writes) {
			expect(permissionOfField(field)).toEqual([PermissionsEnum.ALL_ORG_EDIT, permission]);
		}
	});
});

describe('DashboardResolver — a capability that is switched off is not served', () => {
	it('declares the capability the commerce catalogue declares for this surface, on the class', () => {
		// One statement, read by the guard with `getAllAndOverride` over the handler and then the class,
		// so every field is behind it.
		expect(Reflect.getMetadata(FEATURE_METADATA, DashboardResolver)).toBe(FEATURE_GRAPHQL);
		expect(Reflect.getMetadata('__guards__', DashboardResolver)).toContain(FeatureFlagGuard);
	});

	it('refuses a field whose capability is switched off, and names the field it refused', async () => {
		const { guard, featureService } = gate(false);

		const refusal = await guard.canActivate(graphqlContext('dashboards')).catch((thrown) => thrown);

		// The code the guard resolved is the one this resolver declared, not a second copy of it.
		expect(featureService.isFeatureEnabled).toHaveBeenCalledWith(FEATURE_GRAPHQL);
		expect(refusal).toBeInstanceOf(NotFoundException);
		expect((refusal as Error).message).toContain('dashboards');
		expect((refusal as NotFoundException).getStatus()).toBe(404);
	});

	it('refuses the writes as well, the removal and the two lifecycle moves included', async () => {
		for (const field of ['createDashboard', 'deleteDashboard', 'softDeleteDashboard', 'recoverDashboard']) {
			const { guard } = gate(false);

			await expect(guard.canActivate(graphqlContext(field))).rejects.toBeInstanceOf(NotFoundException);
		}
	});

	it('serves the field once the capability is switched on', async () => {
		const { guard } = gate(true);

		await expect(guard.canActivate(graphqlContext('dashboard'))).resolves.toBe(true);
	});
});

describe('DashboardModule — the resolver is declared where its dependencies are reachable', () => {
	it('declares the resolver as a provider of the module that owns the service', () => {
		const providers = (Reflect.getMetadata(MODULE_METADATA.PROVIDERS, DashboardModule) ?? []) as unknown[];

		expect(providers).toContain(DashboardResolver);
		expect(providers).toContain(DashboardService);
	});

	it('exports the service and the command bus the resolver injects', () => {
		// A resolver is a provider of whichever module the Apollo configuration names, so a module that
		// imports this one receives what this one hands on and nothing else.
		const exported = (Reflect.getMetadata(MODULE_METADATA.EXPORTS, DashboardModule) ?? []) as unknown[];

		expect(exported).toContain(DashboardService);
		expect(exported).toContain(CqrsModule);
	});
});
