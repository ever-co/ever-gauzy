/**
 * 🛑 This import must stay FIRST, before any import that pulls a core service or controller — see
 * `channel.controller.spec.ts` for the cycle it avoids: an entity decorator is undefined when the
 * entity applies it if the graph is entered through the validators rather than through the entities.
 */
import '../core/entities/internal';

import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { BadRequestException, ConflictException, ExecutionContext, ForbiddenException, NotFoundException } from '@nestjs/common';
import { environment as env } from '@gauzy/config';
import { MODULE_METADATA } from '@nestjs/common/constants';
import { Reflector } from '@nestjs/core';
import { buildSchema, printSchema } from 'graphql';
import { ID as Id, RolesEnum } from '@gauzy/contracts';
import { FEATURE_METADATA, PERMISSIONS_METADATA, PUBLIC_METHOD_METADATA, ROLES_METADATA } from '@gauzy/constants';
import { CursorCodec } from '../api/cursor';
import { RequestContext } from '../core/context';
import { FeatureFlagGuard, RoleGuard, TenantPermissionGuard } from '../shared/guards';
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
		// The menu reader answers the rows without the computed flag; the field states it.
		getMenuItems: jest.fn().mockResolvedValue([{ ...ROWS[0], showInMenu: false }]),
		createReport: jest.fn().mockResolvedValue(ROWS[1])
	};
	const reportCategoryService = {
		findAll: jest.fn().mockResolvedValue({ items: CATEGORY_ROWS, total: CATEGORY_ROWS.length }),
		createCategory: jest.fn().mockResolvedValue(CATEGORY_ROWS[0]),
		updateCategory: jest.fn().mockResolvedValue(CATEGORY_ROWS[0]),
		withdrawCategory: jest.fn().mockResolvedValue(true)
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

/**
 * The root fields this domain declares, read off this domain's own documents.
 *
 * Ownership is not the name. The time-tracking domain declares report fields of its own —
 * `timeLogWeeklyReport`, `timeLogOwedAmountReport`, `dailyActivitiesReport` and their siblings — and
 * those mirror its routes, not this domain's. A filter on the word "report" adopts every one of them
 * the moment they are added, and then reports this domain as declaring capabilities it never declared;
 * asking the documents that would have to declare a field is what keeps the two apart.
 */
function ownedRootFields(operation: 'Query' | 'Mutation'): string[] {
	const documents = readdirSync(join(__dirname, 'schema'))
		.filter((name) => name.endsWith('.gql'))
		.map((name) => readFileSync(join(__dirname, 'schema', name), 'utf8'))
		.join('\n');

	// A root field is declared here when this document states its name at the start of a member — as a
	// field with arguments or without one — and the composed schema agrees that the field exists.
	return rootFields(operation)
		.filter((field) => new RegExp(`(^|\\n)[\\t ]*${field}[\\t ]*[(:\n]`).test(documents))
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
	{ field: 'reportMenuItems', controller: ReportController, route: 'getMenuItems' },
	{ field: 'updateReportMenu', controller: ReportController, route: 'updateReportMenu' },
	{ field: 'createReport', controller: ReportController, route: 'create' },
	{ field: 'createReportCategory', controller: ReportCategoryController, route: 'create' },
	{ field: 'updateReportCategory', controller: ReportCategoryController, route: 'update' },
	{ field: 'deleteReportCategory', controller: ReportCategoryController, route: 'delete' }
];

/** The catalogue's authoring fields: the writes that reach the global tables. */
const AUTHORING = ['createReport', 'createReportCategory', 'updateReportCategory', 'deleteReportCategory'];

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

	it('declares the reads and the writes the controllers serve, and no more', () => {
		expect(ownedRootFields('Query')).toEqual(['reportCategories', 'reportMenuItems', 'reports']);
		expect(ownedRootFields('Mutation')).toEqual([
			'createReport',
			'createReportCategory',
			'deleteReportCategory',
			'updateReportCategory',
			'updateReportMenu'
		]);
	});

	it('declares no node field and no count field, because no route serves one', () => {
		// Neither controller serves a `GET /:id` or a `GET /count`: one report is the connection
		// narrowed, and the catalogue answers a menu rather than a total.
		expect(rootFields('Query')).not.toEqual(expect.arrayContaining(['report', 'reportCount']));
		expect(printed).not.toMatch(/reportCount/);
	});

	it('declares the authoring writes the routes serve, and none they do not', () => {
		// A report is filed and never edited or withdrawn over either protocol; a category is filed, edited
		// and withdrawn. A field for a write no route serves would be a capability REST does not have.
		expect(ownedRootFields('Mutation')).not.toEqual(expect.arrayContaining(['updateReport']));
		expect(ownedRootFields('Mutation')).not.toEqual(expect.arrayContaining(['deleteReport']));
		expect(printed).toMatch(/createReport\(input: CreateReportInput!\): Report!/);
		expect(printed).toMatch(/createReportCategory\(input: CreateReportCategoryInput!\): ReportCategory!/);
		expect(printed).toMatch(/updateReportCategory\(input: UpdateReportCategoryInput!\): ReportCategory!/);
		expect(printed).toMatch(/deleteReportCategory\(id: ID!\): Boolean!/);
		// `showInMenu` is computed per organization, never authored.
		expect(inputMemberNames('CreateReportInput')).not.toContain('showInMenu');
	});

	it('declares the menu read with the route’s organization and the list’s protocol', () => {
		expect(fieldArgs('Query', 'reportMenuItems')).toEqual([
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
		expect(printed).toMatch(/reportMenuItems\([^)]*\): ReportConnection!/);
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

	it('reads the menu through the reader the menu route calls, with every row marked as a menu entry', async () => {
		const { resolver, reportService } = surfaces();

		const connection = await resolver.reportMenuItems(ORGANIZATION);

		expect(reportService.getMenuItems).toHaveBeenCalledWith({ organizationId: ORGANIZATION });
		expect(connection.nodes.map((node) => node.id)).toEqual([MENU_REPORT]);
		expect(connection.nodes.every((node) => node.showInMenu === true)).toBe(true);
	});

	it('reads the credential’s organization’s menu when the caller names none', async () => {
		const { resolver, reportService } = surfaces();
		const organization = jest.spyOn(RequestContext, 'currentOrganizationId').mockReturnValue(ORGANIZATION);

		try {
			await resolver.reportMenuItems();
			expect(reportService.getMenuItems).toHaveBeenCalledWith({ organizationId: ORGANIZATION });
		} finally {
			organization.mockRestore();
		}
	});

	it('authors the catalogue through the same service methods the routes call', async () => {
		const { resolver, reportService, reportCategoryService } = surfaces();
		const report = { name: 'Payments received', slug: 'payments-received', categoryId: CATEGORY };

		expect(await resolver.createReport(report)).toBe(ROWS[1]);
		expect(reportService.createReport).toHaveBeenCalledWith(report);

		expect(await resolver.createReportCategory({ name: 'Finance' })).toBe(CATEGORY_ROWS[0]);
		expect(reportCategoryService.createCategory).toHaveBeenCalledWith({ name: 'Finance' });

		await resolver.updateReportCategory({ id: CATEGORY, iconClass: 'pie-chart-outline' });
		expect(reportCategoryService.updateCategory).toHaveBeenCalledWith(CATEGORY, { iconClass: 'pie-chart-outline' });

		expect(await resolver.deleteReportCategory(CATEGORY)).toBe(true);
		expect(reportCategoryService.withdrawCategory).toHaveBeenCalledWith(CATEGORY);

		// The routes reach the same methods with the same members.
		const reports = new ReportController(reportService as never, {} as never);
		const categories = new ReportCategoryController(reportCategoryService as never);
		await reports.create(report as never);
		expect(reportService.createReport).toHaveBeenLastCalledWith(report);
		await categories.create({ name: 'Finance' } as never);
		await categories.update(CATEGORY, { name: 'Money' } as never);
		expect(reportCategoryService.updateCategory).toHaveBeenLastCalledWith(CATEGORY, { name: 'Money' });
		expect(await categories.delete(CATEGORY)).toBe(true);
	});

	it('answers false for a category that is not there, which is what the service answers', async () => {
		const { resolver, reportCategoryService } = surfaces();
		reportCategoryService.withdrawCategory.mockResolvedValueOnce(false);

		expect(await resolver.deleteReportCategory(OTHER_REPORT)).toBe(false);
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
		// And so is the role a handler requires.
		const fields = ReportResolver.prototype as unknown as Record<string, object>;
		expect(Reflect.getMetadata(ROLES_METADATA, fields[field])).toEqual(
			Reflect.getMetadata(ROLES_METADATA, handlersOf(controller)[route])
		);
	});

	it('gates every authoring write to SUPER_ADMIN, because the catalogue has no tenant', () => {
		const fields = ReportResolver.prototype as unknown as Record<string, object>;

		for (const field of AUTHORING) {
			expect(Reflect.getMetadata(ROLES_METADATA, fields[field])).toEqual([RolesEnum.SUPER_ADMIN]);
			expect(guardsOfField(field)).toEqual([TenantPermissionGuard, RoleGuard]);
		}

		// The reads and the menu write stay open to every signed-in member, as their routes are.
		for (const field of ['reports', 'reportCategories', 'reportMenuItems', 'updateReportMenu']) {
			expect(Reflect.getMetadata(ROLES_METADATA, fields[field])).toBeUndefined();
		}
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

describe('Report authoring — the global catalogue, written only where it is safe to', () => {
	const authoring = env.reportCatalogueAuthoring;
	beforeEach(() => {
		env.reportCatalogueAuthoring = true;
	});
	afterEach(() => {
		env.reportCatalogueAuthoring = authoring;
		jest.restoreAllMocks();
	});

	/** The report service over a scripted category read and a scripted store. */
	function reports(options: { categoryLive?: boolean; slugTaken?: boolean } = {}) {
		const categories = {
			findOneByIdString: jest.fn().mockImplementation(async () => {
				if (options.categoryLive === false) {
					throw new NotFoundException();
				}

				return CATEGORY_ROWS[0];
			})
		};
		const service = new ReportService({} as never, {} as never, categories as never);
		const countBy = jest.spyOn(service, 'countBy').mockResolvedValue(options.slugTaken ? 1 : 0);
		const create = jest
			.spyOn(service, 'create')
			.mockImplementation(async (row) => ({ id: OTHER_REPORT, ...row }) as never);

		return { service, categories, countBy, create };
	}

	it('files a well-formed report under a live category, with the menu flag off', async () => {
		const { service, categories, countBy, create } = reports();

		await service.createReport({ name: ' Payments received ', slug: 'payments-received', categoryId: CATEGORY });

		expect(categories.findOneByIdString).toHaveBeenCalledWith(CATEGORY);
		expect(countBy).toHaveBeenCalledWith({ slug: 'payments-received' });
		expect(create).toHaveBeenCalledWith(
			expect.objectContaining({ name: 'Payments received', slug: 'payments-received', showInMenu: false })
		);
	});

	it('refuses a malformed slug, an empty name and an oversized member before anything is written', async () => {
		const { service, create } = reports();

		for (const input of [
			{ name: 'Payments', slug: 'Payments Received', categoryId: CATEGORY },
			{ name: '   ', slug: 'payments', categoryId: CATEGORY },
			{ name: 'Payments', slug: 'payments', categoryId: CATEGORY, description: 'x'.repeat(256) }
		]) {
			await expect(service.createReport(input)).rejects.toBeInstanceOf(BadRequestException);
		}

		expect(create).not.toHaveBeenCalled();
	});

	it('refuses a slug a live report already has, and a category that is not live', async () => {
		const taken = reports({ slugTaken: true });
		await expect(
			taken.service.createReport({ name: 'Time', slug: 'time-and-activity', categoryId: CATEGORY })
		).rejects.toBeInstanceOf(ConflictException);
		expect(taken.create).not.toHaveBeenCalled();

		const orphan = reports({ categoryLive: false });
		await expect(
			orphan.service.createReport({ name: 'Time', slug: 'time', categoryId: CATEGORY })
		).rejects.toBeInstanceOf(NotFoundException);
		expect(orphan.create).not.toHaveBeenCalled();
	});

	/** The category service over a scripted store. */
	function categories(row: unknown | NotFoundException) {
		const service = new ReportCategoryService({} as never, {} as never);
		const read = jest.spyOn(service, 'findOneByIdString').mockImplementation(async () => {
			if (row instanceof NotFoundException) {
				throw row;
			}

			return row as never;
		});
		const softRemove = jest.spyOn(service, 'softRemove').mockResolvedValue(CATEGORY_ROWS[0] as never);
		const update = jest.spyOn(service, 'update').mockResolvedValue({ affected: 1 } as never);
		const create = jest.spyOn(service, 'create').mockImplementation(async (value) => value as never);

		return { service, read, softRemove, update, create };
	}

	it('withdraws an empty category by soft delete and answers true', async () => {
		const { service, read, softRemove } = categories({ ...CATEGORY_ROWS[0], reports: [] });

		expect(await service.withdrawCategory(CATEGORY)).toBe(true);
		expect(read).toHaveBeenCalledWith(CATEGORY, { relations: { reports: true } });
		expect(softRemove).toHaveBeenCalledWith(CATEGORY);
	});

	it('answers false for a category that is not there, and withdraws nothing', async () => {
		const { service, softRemove } = categories(new NotFoundException());

		expect(await service.withdrawCategory(CATEGORY)).toBe(false);
		expect(softRemove).not.toHaveBeenCalled();
	});

	it('refuses to withdraw a category a live report is still filed under', async () => {
		const { service, softRemove } = categories({ ...CATEGORY_ROWS[0], reports: [ROWS[0]] });

		await expect(service.withdrawCategory(CATEGORY)).rejects.toBeInstanceOf(ConflictException);
		expect(softRemove).not.toHaveBeenCalled();
	});

	it('files and edits a category with its members checked, leaving unstated members as they are', async () => {
		const { service, update, create } = categories(CATEGORY_ROWS[0]);

		await service.createCategory({ name: ' Finance ' });
		expect(create).toHaveBeenCalledWith({ name: 'Finance', iconClass: undefined });
		await expect(service.createCategory({ name: '' })).rejects.toBeInstanceOf(BadRequestException);

		await service.updateCategory(CATEGORY, { iconClass: 'pie-chart-outline' });
		expect(update).toHaveBeenCalledWith(CATEGORY, { iconClass: 'pie-chart-outline' });
		await expect(service.updateCategory(CATEGORY, { name: '  ' })).rejects.toBeInstanceOf(BadRequestException);
	});
});

describe('Report authoring — off unless the deployment enables it', () => {
	const authoring = env.reportCatalogueAuthoring;
	afterEach(() => {
		env.reportCatalogueAuthoring = authoring;
		jest.restoreAllMocks();
	});

	it('is off by default, because every tenant owner is a Super Admin of their own tenant', () => {
		delete process.env.REPORT_CATALOGUE_AUTHORING_ENABLED;
		expect(Boolean(authoring)).toBe(false);
	});

	it('refuses every catalogue write, before anything is read or written, when the deployment has not enabled it', async () => {
		env.reportCatalogueAuthoring = false;
		const categories = { findOneByIdString: jest.fn() };
		const service = new ReportService({} as never, {} as never, categories as never);
		const create = jest.spyOn(service, 'create');
		const categoryService = new ReportCategoryService({} as never, {} as never);
		const categoryCreate = jest.spyOn(categoryService, 'create');

		await expect(
			service.createReport({ name: 'Time', slug: 'time-and-activity', categoryId: CATEGORY })
		).rejects.toBeInstanceOf(ForbiddenException);
		await expect(categoryService.createCategory({ name: 'Finance' })).rejects.toBeInstanceOf(ForbiddenException);
		await expect(categoryService.updateCategory(CATEGORY, { name: 'Money' })).rejects.toBeInstanceOf(
			ForbiddenException
		);
		await expect(categoryService.withdrawCategory(CATEGORY)).rejects.toBeInstanceOf(ForbiddenException);
		expect(categories.findOneByIdString).not.toHaveBeenCalled();
		expect(create).not.toHaveBeenCalled();
		expect(categoryCreate).not.toHaveBeenCalled();
	});
});
