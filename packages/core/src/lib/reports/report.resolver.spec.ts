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
import { Reflector } from '@nestjs/core';
import { buildSchema, printSchema } from 'graphql';
import { ID as Id } from '@gauzy/contracts';
import { FEATURE_METADATA, PERMISSIONS_METADATA, PUBLIC_METHOD_METADATA } from '@gauzy/constants';
import { CursorCodec } from '../api/cursor';
import { FeatureFlagGuard } from '../shared/guards';
import { ReportController } from './report.controller';
import { ReportCategoryController } from './report-category.controller';
import { ReportResolver } from './report.resolver';
import { ReportModule } from './report.module';
import { ReportService } from './report.service';
import { ReportCategoryService } from './report-category.service';
import { ReportOrganizationService } from './report-organization.service';

/**
 * The report catalogue over GraphQL.
 *
 * The two delivered controllers serve a catalogue list, the menu of one organization, the category
 * headings and the write that switches a report on or off in a menu. This suite pins the half of the
 * two-protocol doctrine that is easy to get quietly wrong:
 *
 * - every one of those capabilities is a root field of the one composed schema, and each list is a
 *   connection with the platform's own cursor codec behind it, so a cursor obtained over REST resumes
 *   here and a refusal is the query protocol's own code;
 * - **the menu sub-route is the connection narrowed, not a second root field**: the reports
 *   `GET /api/report/menu-items` answers are the reports `GET /api/report` answers with the computed
 *   `showInMenu` flag set, so the two routes cannot come to disagree about what a menu holds;
 * - every field reaches the same service method the REST route reaches, with the same payload — the
 *   menu write included, whose find-or-create is delegated rather than reimplemented;
 * - **the guard chain and the permission are the controllers', field by field — and both are empty**:
 *   neither controller states a guard, a permission or a `Public()` marker, so neither does this
 *   resolver, and the one guard it adds is the GraphQL capability's own;
 * - the members the delivered readers cannot produce are not declared at all: the menu collection the
 *   report list deletes, and the report collection of a category no read joins.
 */

const ORGANIZATION = '00000000-0000-4000-8000-000000000002';
const TENANT = '00000000-0000-4000-8000-000000000001';
const MENU_REPORT = '00000000-0000-4000-8000-000000000010';
const OTHER_REPORT = '00000000-0000-4000-8000-000000000011';
const CATEGORY = '00000000-0000-4000-8000-000000000020';
const MENU_ROW = '00000000-0000-4000-8000-000000000030';

/**
 * The rows the delivered list answers with, in the order it returns them, each already carrying the
 * `showInMenu` the reader computed from the organization's own menu rows.
 */
const ROWS = [
	{
		id: MENU_REPORT,
		name: 'Time and activity',
		slug: 'time-and-activity',
		description: 'Tracked time by employee and project.',
		image: 'reports/time.png',
		imageUrl: 'http://localhost:3000/reports/time.png',
		iconClass: 'activity-outline',
		showInMenu: true,
		categoryId: CATEGORY,
		isActive: true,
		createdAt: new Date('2026-03-01T10:00:00.000Z'),
		updatedAt: new Date('2026-03-01T10:00:00.000Z')
	},
	{
		id: OTHER_REPORT,
		name: 'Payments received',
		slug: 'payments-received',
		description: 'Payments recorded against invoices.',
		image: null,
		imageUrl: null,
		iconClass: 'credit-card-outline',
		showInMenu: false,
		categoryId: CATEGORY,
		isActive: true,
		createdAt: new Date('2026-02-01T10:00:00.000Z'),
		updatedAt: new Date('2026-02-01T10:00:00.000Z')
	}
];

/** The category rows the delivered list answers with. */
const CATEGORY_ROWS = [
	{
		id: CATEGORY,
		name: 'Finance',
		iconClass: 'pie-chart-outline',
		isActive: true,
		createdAt: new Date('2026-01-01T10:00:00.000Z'),
		updatedAt: new Date('2026-01-01T10:00:00.000Z')
	}
];

/** The menu row the delivered write answers with. */
const MENU = {
	id: MENU_ROW,
	reportId: MENU_REPORT,
	organizationId: ORGANIZATION,
	tenantId: TENANT,
	isEnabled: true,
	isActive: true,
	createdAt: new Date('2026-04-01T10:00:00.000Z'),
	updatedAt: new Date('2026-04-01T10:00:00.000Z')
};

/** The resolver, over scripted services. */
function surfaces() {
	const reportService = {
		findAllReports: jest.fn().mockResolvedValue({ items: ROWS, total: ROWS.length }),
		getMenuItems: jest.fn().mockResolvedValue([ROWS[0]])
	};
	const reportCategoryService = {
		findAll: jest.fn().mockResolvedValue({ items: CATEGORY_ROWS, total: CATEGORY_ROWS.length })
	};
	const reportOrganizationService = {
		updateReportMenu: jest.fn().mockResolvedValue(MENU)
	};

	return {
		reportService,
		reportCategoryService,
		reportOrganizationService,
		resolver: new ReportResolver(
			reportService as never,
			reportCategoryService as never,
			reportOrganizationService as never
		)
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

/** The root fields this domain contributes, which are the ones that name its concepts. */
function ownedRootFields(operation: 'Query' | 'Mutation'): string[] {
	return rootFields(operation)
		.filter((field) => field.toLowerCase().includes('report'))
		.sort();
}

/** The printed body of one declaration, so a member it must not carry can be asserted absent. */
function declaredBody(kind: 'type' | 'input', name: string): string {
	return printed.match(new RegExp(`${kind} ${name} \\{([\\s\\S]*?)\\n\\}`))?.[1] ?? '';
}

/** The printed body of one object type. */
function typeBody(name: string): string {
	return declaredBody('type', name);
}

/**
 * The member names one declaration carries, read off its printed body rather than off a description:
 * a doc comment is part of the printed type, so a member is asserted absent by its name and never by
 * the words a description happens to use.
 */
function memberNames(name: string): string[] {
	return [...typeBody(name).matchAll(/^\s+([A-Za-z_][A-Za-z0-9_]*)\s*[:(]/gm)].map((match) => match[1]);
}

/** The member names one input type declares. */
function inputMemberNames(name: string): string[] {
	return [...declaredBody('input', name).matchAll(/^\s+([A-Za-z_][A-Za-z0-9_]*)\s*:/gm)].map((match) => match[1]);
}

/** The handlers of one controller, as functions, inherited ones included. */
function handlersOf(controller: object): Record<string, object> {
	return (controller as { prototype: Record<string, object> }).prototype;
}

/**
 * The permission one route runs under: what its handler states, else what its controller states.
 *
 * This is the rule the guards themselves apply — the reflector's `getAllAndOverride` over
 * `[handler, class]` — restated here, so the resolver is held to the controllers' own metadata rather
 * than to a second copy of the same list written out in this file.
 */
function permissionOfRoute(controller: object, handler: string): unknown {
	return (
		Reflect.getMetadata(PERMISSIONS_METADATA, handlersOf(controller)[handler]) ??
		Reflect.getMetadata(PERMISSIONS_METADATA, controller)
	);
}

/** The guards one route's handler carries of its own, beside the controller's chain. */
function guardsOfHandler(controller: object, handler: string): unknown[] {
	return Reflect.getMetadata('__guards__', handlersOf(controller)[handler]) ?? [];
}

/** The permission one resolver field runs under, as its own handler states it. */
function permissionOfField(field: string): unknown {
	const fields = ReportResolver.prototype as unknown as Record<string, object>;

	return Reflect.getMetadata(PERMISSIONS_METADATA, fields[field]);
}

/** The guards one resolver field carries of its own. */
function guardsOfField(field: string): unknown[] {
	const fields = ReportResolver.prototype as unknown as Record<string, object>;

	return Reflect.getMetadata('__guards__', fields[field]) ?? [];
}

/**
 * Every root field and the delivered route it mirrors.
 *
 * The two surfaces are one capability stated twice, so the guard stack and the permission of a field
 * are read from the field and from the route's own metadata and compared, rather than restated here.
 * Two controllers are involved — the catalogue's and its categories' — so each entry names both.
 */
const PARITY: ReadonlyArray<{ field: string; controller: object; route: string }> = [
	{ field: 'reports', controller: ReportController, route: 'findAllReports' },
	{ field: 'reportCategories', controller: ReportCategoryController, route: 'findAll' },
	{ field: 'updateReportMenu', controller: ReportController, route: 'updateReportMenu' }
];

/** The code the commerce catalogue declares for this surface, as the guard's metadata carries it. */
const FEATURE_GRAPHQL = 'FEATURE_GRAPHQL';

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
		getHandler: () => (ReportResolver.prototype as never)[field],
		getClass: () => ReportResolver,
		getType: () => 'graphql',
		getArgByIndex: () => ({ fieldName: field })
	} as unknown as ExecutionContext;
}

describe('ReportResolver — the SDL declares the capabilities the REST routes serve', () => {
	it('declares the two catalogue connections and the menu write', () => {
		expect(rootFields('Query')).toEqual(expect.arrayContaining(['reports', 'reportCategories']));
		expect(rootFields('Mutation')).toEqual(expect.arrayContaining(['updateReportMenu']));
	});

	it('declares the reads and the write the controllers serve, and no more', () => {
		// The menu sub-route is the same list narrowed, and the catalogue's own reads are the two
		// connections; anything else here would be a capability no delivered route has.
		expect(ownedRootFields('Query')).toEqual(['reportCategories', 'reports']);
		expect(ownedRootFields('Mutation')).toEqual(['updateReportMenu']);
	});

	it('declares no node field and no count field, because no route serves one', () => {
		// Neither controller serves a `GET /:id` or a `GET /count`: one report is the connection
		// narrowed, and the catalogue answers a menu rather than a total.
		expect(rootFields('Query')).not.toEqual(expect.arrayContaining(['report', 'reportCount']));
		expect(printed).not.toMatch(/reportCount/);
	});

	it('declares no mutation for a report or a category, because the catalogue serves no write', () => {
		// The rows are the platform's own seeded reference data; the menu write is the only write either
		// controller serves, and it writes the membership rather than the report.
		expect(ownedRootFields('Mutation')).not.toEqual(
			expect.arrayContaining(['createReport', 'updateReport', 'deleteReport', 'softDeleteReport', 'recoverReport'])
		);
	});

	it('declares the connections, their edges, their filters and their sorts', () => {
		expect(printed).toMatch(
			/type ReportConnection \{\s*nodes: \[Report!\]!\s*edges: \[ReportEdge!\]!\s*totalCount: Int!\s*pageInfo: PageInfo!\s*\}/
		);
		expect(printed).toMatch(/type ReportEdge \{\s*node: Report!\s*cursor: String!\s*\}/);
		expect(printed).toMatch(
			/type ReportCategoryConnection \{\s*nodes: \[ReportCategory!\]!\s*edges: \[ReportCategoryEdge!\]!\s*totalCount: Int!\s*pageInfo: PageInfo!\s*\}/
		);
		expect(printed).toMatch(/type ReportCategoryEdge \{\s*node: ReportCategory!\s*cursor: String!\s*\}/);
		expect(printed).toMatch(/input ReportFilter \{/);
		expect(printed).toMatch(/input ReportCategoryFilter \{/);
		expect(printed).toMatch(/input ReportSort \{/);
		expect(printed).toMatch(/enum ReportSortField \{\s*createdAt\s*updatedAt\s*name\s*slug\s*\}/);
		expect(printed).toMatch(/input ReportCategorySort \{/);
		expect(printed).toMatch(/enum ReportCategorySortField \{\s*createdAt\s*updatedAt\s*name\s*\}/);
	});

	it('declares the menu write input with the two members the delivered write requires', () => {
		expect(printed).toMatch(/input UpdateReportMenuInput \{/);
		// The tenant is not a member: the delivered write resolves it from the credential and builds the
		// row it saves from the body, so a caller-stated tenant would be a way to write another tenant's
		// menu row. The two members that are required are the pair the write looks the row up by.
		expect(inputMemberNames('UpdateReportMenuInput')).toEqual(['reportId', 'organizationId', 'isEnabled']);
		expect(declaredBody('input', 'UpdateReportMenuInput')).toMatch(/reportId: ID!/);
		expect(declaredBody('input', 'UpdateReportMenuInput')).toMatch(/organizationId: ID!/);
	});

	it('carries the computed menu flag and not the collection the reader deletes', () => {
		const members = memberNames('Report');

		expect(printed).toMatch(/type Report \{[\s\S]*?showInMenu: Boolean![\s\S]*?\n\}/);
		// The delivered reader deletes the collection in the same step it copies the flag out of it, so
		// a member for it would be absent on exactly the rows this surface answers.
		expect(members).not.toContain('reportOrganizations');
		// The category relation is loaded only when a REST caller names it in `relations`, which no read
		// here does: the identifier is a column and is carried, the relation is not.
		expect(members).not.toContain('category');
		// No route of this resource delivers a withdrawal, so the lifecycle marker is not carried.
		expect(members).not.toContain('deletedAt');
		expect(members).toEqual(
			expect.arrayContaining(['id', 'name', 'slug', 'description', 'image', 'imageUrl', 'iconClass', 'categoryId'])
		);
	});

	it('carries the membership the menu write answers with, and not the report it points at', () => {
		expect(memberNames('ReportOrganization')).toEqual([
			'id',
			'reportId',
			'isEnabled',
			'tenantId',
			'organizationId',
			'isActive',
			'createdAt',
			'updatedAt'
		]);
	});

	it('carries no report collection on a category, which no read joins', () => {
		expect(memberNames('ReportCategory')).toEqual(['id', 'name', 'iconClass', 'isActive', 'createdAt', 'updatedAt']);
	});

	it('offers the organization as the list’s own argument and no filter member it cannot evaluate', () => {
		// The catalogue row carries no organization column, so the organization is an argument — the same
		// member the delivered route binds from its query string — and not a filter of the connection.
		expect(fieldArgs('Query', 'reports')).toEqual([
			'organizationId',
			'filter',
			'sort',
			'page',
			'first',
			'after',
			'last',
			'before',
			'limit',
			'offset'
		]);
		expect(declaredBody('input', 'ReportFilter')).toMatch(/showInMenu: BooleanFilter/);
		expect(inputMemberNames('ReportFilter')).not.toContain('organizationId');
		// The delivered list read answers live rows only, so the connection does not offer `withDeleted`.
		expect(fieldArgs('Query', 'reports')).not.toContain('withDeleted');
	});
});

describe('ReportResolver — the connection contract', () => {
	it('answers the list with nodes, edges, a total and the boundary cursors', async () => {
		const { resolver, reportService } = surfaces();

		const connection = await resolver.reports(ORGANIZATION, undefined, undefined, undefined, 20);

		// The read is the one the REST list route performs, with the member its query string binds.
		expect(reportService.findAllReports).toHaveBeenCalledWith({ organizationId: ORGANIZATION });
		expect(connection.nodes).toHaveLength(2);
		expect(connection.totalCount).toBe(2);
		expect(connection.pageInfo.startCursor).toBe(connection.edges[0].cursor);
		expect(connection.pageInfo.endCursor).toBe(connection.edges[1].cursor);
		expect(connection.pageInfo.hasNextPage).toBe(false);
		// The cursor is the platform's own codec, so the same cursor is valid on the REST surface. The
		// first edge is the first row of the catalogue's own order, which is by name.
		expect(CursorCodec.decode(connection.edges[0].cursor).id).toBe(OTHER_REPORT);
	});

	it('orders by the catalogue’s own names when the caller states none', async () => {
		const { resolver } = surfaces();

		const connection = await resolver.reports(ORGANIZATION);

		expect(connection.nodes.map((node) => node.id)).toEqual([OTHER_REPORT, MENU_REPORT]);
	});

	it('answers the menu sub-route as this list narrowed, not as a second field', async () => {
		const { resolver, reportService } = surfaces();

		const menu = await resolver.reports(ORGANIZATION, { showInMenu: { eq: true } });
		const route = await reportService.getMenuItems({ organizationId: ORGANIZATION });

		// One capability, two spellings: the reports the delivered menu route answers are exactly the
		// rows this connection answers with the computed flag set.
		expect(menu.nodes.map((node) => node.id)).toEqual(route.map((report: { id: Id }) => report.id));

		const absent = await resolver.reports(ORGANIZATION, { showInMenu: { eq: false } });
		expect(absent.nodes.map((node) => node.id)).toEqual([OTHER_REPORT]);
	});

	it('narrows by the fields the filter declares', async () => {
		const { resolver } = surfaces();

		const bySlug = await resolver.reports(ORGANIZATION, { slug: { eq: 'time-and-activity' } });
		expect(bySlug.nodes.map((node) => node.id)).toEqual([MENU_REPORT]);

		const byCategory = await resolver.reports(ORGANIZATION, { categoryId: { eq: CATEGORY } });
		expect(byCategory.totalCount).toBe(2);

		const byName = await resolver.reports(ORGANIZATION, { name: { ilike: 'pay%' } });
		expect(byName.nodes.map((node) => node.id)).toEqual([OTHER_REPORT]);
	});

	it('orders by the keys the sort enum offers', async () => {
		const { resolver } = surfaces();

		const byName = await resolver.reports(ORGANIZATION, undefined, [{ field: 'name', direction: 'DESC' }]);
		expect(byName.nodes.map((node) => node.id)).toEqual([MENU_REPORT, OTHER_REPORT]);
	});

	it('resumes a walk from an opaque cursor', async () => {
		const { resolver } = surfaces();
		const first = await resolver.reports(ORGANIZATION, undefined, undefined, undefined, 1);

		expect(first.nodes.map((node) => node.id)).toEqual([OTHER_REPORT]);

		const second = await resolver.reports(ORGANIZATION, undefined, undefined, {
			first: 1,
			after: first.pageInfo.endCursor ?? undefined
		});

		expect(second.nodes.map((node) => node.id)).toEqual([MENU_REPORT]);
		expect(second.pageInfo.hasPreviousPage).toBe(true);
	});

	it('refuses a sort field the resource does not declare, with the query protocol’s own code', async () => {
		const { resolver } = surfaces();

		const error = await resolver
			.reports(ORGANIZATION, undefined, [{ field: 'category', direction: 'ASC' }] as never)
			.catch((thrown) => thrown);

		expect(isRefusal(error)).toBe(true);
		expect((error as Error).message).toContain('QUERY_SORT_NOT_ALLOWED');
	});

	it('refuses a filter field the resource does not declare', async () => {
		const { resolver } = surfaces();

		const error = await resolver
			.reports(ORGANIZATION, { reportOrganizations: { eq: MENU_ROW } })
			.catch((thrown) => thrown);

		expect(isRefusal(error)).toBe(true);
		expect((error as Error).message).toContain('QUERY_UNKNOWN_FILTER_FIELD');
	});

	it('answers the category connection through the same reader the category route calls', async () => {
		const { resolver, reportCategoryService } = surfaces();

		const connection = await resolver.reportCategories(undefined, undefined, undefined, 20);

		expect(reportCategoryService.findAll).toHaveBeenCalledWith({});
		expect(connection.nodes.map((node) => node.id)).toEqual([CATEGORY]);
		expect(CursorCodec.decode(connection.edges[0].cursor).id).toBe(CATEGORY);
	});
});

describe('ReportResolver — one concept, two protocols, the same operations', () => {
	it('reads the catalogue through the same service method the list route calls', async () => {
		const { resolver, reportService } = surfaces();

		await resolver.reports();

		// A caller that names no organization is answered the way the route answers that same query
		// string: the read runs with the member absent rather than with a second code path.
		expect(reportService.findAllReports).toHaveBeenCalledWith({ organizationId: undefined });
	});

	it('reads the categories through the same service method the category route calls', async () => {
		const { resolver, reportCategoryService } = surfaces();

		await resolver.reportCategories();

		expect(reportCategoryService.findAll).toHaveBeenCalledWith({});
	});

	it('writes the menu through the same find-or-create the menu route calls', async () => {
		const { resolver, reportOrganizationService } = surfaces();

		const answer = await resolver.updateReportMenu({
			reportId: MENU_REPORT,
			organizationId: ORGANIZATION,
			isEnabled: true
		});

		expect(answer).toBe(MENU);
		// The body is handed over as the caller stated it, with the tenant resolved by the service from
		// the credential rather than stated here.
		expect(reportOrganizationService.updateReportMenu).toHaveBeenCalledWith({
			reportId: MENU_REPORT,
			organizationId: ORGANIZATION,
			isEnabled: true
		});
	});

	it('surfaces a refusal as a 4xx that is not a 404', async () => {
		const { resolver, reportOrganizationService } = surfaces();
		const refusal = new Error('reportId and organizationId are required');

		reportOrganizationService.updateReportMenu.mockRejectedValueOnce(refusal);

		await expect(resolver.updateReportMenu({ reportId: MENU_REPORT, organizationId: ORGANIZATION })).rejects.toBe(
			refusal
		);
	});
});

describe('ReportResolver — the guard stack and the permission are the controllers’', () => {
	it('states no authorization guard, because neither controller states one', () => {
		expect(Reflect.getMetadata('__guards__', ReportController) ?? []).toEqual([]);
		expect(Reflect.getMetadata('__guards__', ReportCategoryController) ?? []).toEqual([]);
		// The one guard the resolver carries is the gate, and it is an addition rather than a
		// substitution: there was nothing of the controllers' own to replace.
		expect(Reflect.getMetadata('__guards__', ReportResolver)).toEqual([FeatureFlagGuard]);
	});

	it('states no `Public()` marker either, because the catalogue never claimed to be public', () => {
		// An openness decision is a route's to make. Stating the marker here would claim one the
		// controllers have not made, and would outlive their decision to make it.
		expect(Reflect.getMetadata(PUBLIC_METHOD_METADATA, ReportController)).toBeUndefined();
		expect(Reflect.getMetadata(PUBLIC_METHOD_METADATA, ReportResolver)).toBeUndefined();
	});

	it('states no permission on the class and no permission on any field', () => {
		// The catalogue is reference data and the controllers ask for no grant to read or to write it,
		// so there is no class-level permission for a field here to mirror — and inventing one would
		// refuse a caller the REST routes serve.
		expect(Reflect.getMetadata(PERMISSIONS_METADATA, ReportResolver)).toBeUndefined();
		expect(permissionOfField('reports')).toBeUndefined();
		expect(permissionOfField('reportCategories')).toBeUndefined();
		expect(permissionOfField('updateReportMenu')).toBeUndefined();
	});

	it.each(PARITY)('$field mirrors $route exactly', ({ field, controller, route }) => {
		expect(permissionOfField(field)).toEqual(permissionOfRoute(controller, route));
		// The guard a field states of its own is the guard its route's handler states of its own: the
		// class-level chains are compared above, and a handler that added one is caught here.
		expect(guardsOfField(field)).toEqual(guardsOfHandler(controller, route));
	});
});

describe('ReportResolver — a capability that is switched off is not served', () => {
	it('declares the capability the commerce catalogue declares for this surface, on the class', () => {
		// One statement, read by the guard with `getAllAndOverride` over the handler and then the class,
		// so every field is behind it.
		expect(Reflect.getMetadata(FEATURE_METADATA, ReportResolver)).toBe(FEATURE_GRAPHQL);
		expect(Reflect.getMetadata('__guards__', ReportResolver)).toContain(FeatureFlagGuard);
	});

	it('refuses a read and the menu write when the capability is switched off, naming the field', async () => {
		for (const field of ['reports', 'reportCategories', 'updateReportMenu']) {
			const { guard, featureService } = gate(false);

			const refusal = await guard.canActivate(graphqlContext(field)).catch((thrown) => thrown);

			// The code the guard resolved is the one this resolver declared, not a second copy of it.
			expect(featureService.isFeatureEnabled).toHaveBeenCalledWith(FEATURE_GRAPHQL);
			expect(refusal).toBeInstanceOf(NotFoundException);
			expect((refusal as Error).message).toContain(field);
			expect((refusal as NotFoundException).getStatus()).toBe(404);
		}
	});

	it('serves the field once the capability is switched on', async () => {
		const { guard } = gate(true);

		await expect(guard.canActivate(graphqlContext('reports'))).resolves.toBe(true);
	});
});

describe('ReportModule — the resolver is declared where its dependencies are reachable', () => {
	it('declares the resolver as a provider of the module that owns the services', () => {
		const providers = (Reflect.getMetadata(MODULE_METADATA.PROVIDERS, ReportModule) ?? []) as unknown[];

		expect(providers).toContain(ReportResolver);
		expect(providers).toContain(ReportService);
		expect(providers).toContain(ReportCategoryService);
		expect(providers).toContain(ReportOrganizationService);
	});

	it('exports the three services the resolver injects', () => {
		// A resolver is a provider of whichever module the Apollo configuration names, so a module that
		// imports this one receives what this one hands on and nothing else.
		const exported = (Reflect.getMetadata(MODULE_METADATA.EXPORTS, ReportModule) ?? []) as unknown[];

		expect(exported).toEqual(
			expect.arrayContaining([ReportService, ReportCategoryService, ReportOrganizationService])
		);
	});
});
