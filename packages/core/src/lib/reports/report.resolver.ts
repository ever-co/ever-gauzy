import { UseGuards } from '@nestjs/common';
import { Args, ID, Int, Mutation, Query, Resolver } from '@nestjs/graphql';
import { FeatureFlag } from '@gauzy/common';
import { GetReportMenuItemsInput, ID as Id, IPagination, UpdateReportMenuInput } from '@gauzy/contracts';
import {
	ConnectionFilter,
	ConnectionPageRequest,
	ConnectionSortKey,
	GraphqlConnection,
	buildConnection
} from '../api/graphql-connection';
import { BaseQueryDTO } from '../core/crud';
import { FEATURE_GRAPHQL } from '../feature/graphql-feature.code';
import { FeatureFlagGuard } from '../shared/guards';
import { Report } from './report.entity';
import { ReportCategory } from './report-category.entity';
import { ReportOrganization } from './report-organization.entity';
import { ReportService } from './report.service';
import { ReportCategoryService } from './report-category.service';
import { ReportOrganizationService } from './report-organization.service';

/** The members `UpdateReportMenuInput` declares in the schema. */
export interface IUpdateReportMenuInput {
	reportId: Id;
	organizationId: Id;
	isEnabled?: boolean;
}

/**
 * The fields a report list may be filtered and sorted by, and the order it is returned in when the
 * caller states none.
 *
 * This declaration is the resolver's half of the SDL: `ReportFilter` and `ReportSortField` are its two
 * renderings, and keeping the three in one file is what makes a field that is filterable in the schema
 * but unknown to the evaluator — or the reverse — impossible to introduce quietly.
 *
 * Every member is a column of the catalogue row except `showInMenu`, which the delivered list computes
 * from the calling organization's menu rows and writes onto each row before this resolver sees it.
 * That is exactly why it is filterable: the menu sub-route is one selection of the same rows, and the
 * flag the list already computed is the selection it makes.
 */
const REPORT_FILTERABLE = {
	id: 'ID',
	name: 'STRING',
	slug: 'STRING',
	description: 'STRING',
	image: 'STRING',
	imageUrl: 'STRING',
	iconClass: 'STRING',
	showInMenu: 'BOOLEAN',
	categoryId: 'ID',
	isActive: 'BOOLEAN',
	createdAt: 'DATE',
	updatedAt: 'DATE'
} as const;

/** The fields the report sort enum offers. */
const REPORT_SORTABLE = ['createdAt', 'updatedAt', 'name', 'slug'] as const;

/**
 * The order the connection means when the caller states none.
 *
 * The delivered list read applies no order of its own — it joins the menu rows and hands back
 * whatever the store answers — so this is a decision the connection has to make rather than one it
 * reproduces: the catalogue's own order is its names, because a menu is read as a list of names, and
 * the identifier is the last key so that two reports sharing a name still have one order between
 * them, which is what makes a cursor walk over them total.
 */
const REPORT_DEFAULT_SORT: readonly ConnectionSortKey[] = [
	{ field: 'name', direction: 'ASC' },
	{ field: 'id', direction: 'ASC' }
];

/**
 * The fields a category list may be filtered and sorted by.
 *
 * A category carries no menu flag: it is a heading, and the flags belong to the reports filed under
 * it. Stating one here would offer a narrowing the row cannot answer.
 */
const REPORT_CATEGORY_FILTERABLE = {
	id: 'ID',
	name: 'STRING',
	iconClass: 'STRING',
	isActive: 'BOOLEAN',
	createdAt: 'DATE',
	updatedAt: 'DATE'
} as const;

/** The fields the category sort enum offers. */
const REPORT_CATEGORY_SORTABLE = ['createdAt', 'updatedAt', 'name'] as const;

/**
 * The order the category connection answers in when the caller states none: by name, then by the
 * identifier that makes the order total, on the same reasoning as the reports above — the delivered
 * read states no order, and a cursor needs one.
 */
const REPORT_CATEGORY_DEFAULT_SORT: readonly ConnectionSortKey[] = [
	{ field: 'name', direction: 'ASC' },
	{ field: 'id', direction: 'ASC' }
];

/**
 * The report catalogue over GraphQL.
 *
 * REST and GraphQL are two views of the same operations, so this resolver owns no business logic of
 * its own: every field below reaches the same `ReportService`, `ReportCategoryService` or
 * `ReportOrganizationService` method the `/api/report` and `/api/report/category` routes reach.
 *
 * **Neither controller declares a guard and neither declares a permission, and this resolver states
 * neither either.** The catalogue is reference data the platform seeds — a report row belongs to no
 * organization, and only its menu row does — so `ReportController` and `ReportCategoryController`
 * carry no `@UseGuards` and no `@Permissions`, and there is no class-level grant for a field here to
 * mirror. Nothing is stated in their place: a permission invented on this surface would refuse a
 * caller the route serves, and `@Public()` is deliberately not stated either, because it is a claim
 * the catalogue has not made and a marker that would outlive the controller's own decision to make
 * it. What a caller may read is therefore what it may read over REST: whatever the request context
 * resolves for them.
 *
 * **The gate is the catalogue's**: `FEATURE_GRAPHQL` is the code the commerce catalogue declares for
 * the GraphQL endpoint and its resolvers, applied once here so every field below is behind the one
 * capability. `FeatureFlagGuard` reads that code from `FEATURE_METADATA`, over the handler and then
 * the class, which is why the gate is stated on the class rather than restated on each field. It is
 * the one guard this surface adds, and it is added rather than substituted: nothing of the
 * controllers' own is replaced, because they state nothing to replace.
 *
 * **The menu route is not a second list.** The reports an organization's menu shows are the reports
 * this connection answers, narrowed to `showInMenu: { eq: true }` — the flag the delivered read
 * computed from the organization's own menu rows. Stating it as a second root field would be a second
 * surface that could come to disagree with this one about what a menu holds, which is the failure the
 * two-protocol rule exists to prevent.
 */
@Resolver('Report')
@UseGuards(FeatureFlagGuard)
@FeatureFlag(FEATURE_GRAPHQL)
export class ReportResolver {
	constructor(
		private readonly reportService: ReportService,
		private readonly reportCategoryService: ReportCategoryService,
		private readonly reportOrganizationService: ReportOrganizationService
	) {}

	/**
	 * The reports of the catalogue, in name order, each carrying whether the named organization's menu
	 * shows it.
	 *
	 * The read is the delivered list route's own, with the same query parameter it binds:
	 * `findAllReports` joins the menu rows of `organizationId` — which the route takes from its query
	 * string and this field takes as an argument, because the connection's `filter` cannot express a
	 * narrowing over a column the catalogue row does not have — and computes `showInMenu` on every row
	 * it answers. The narrowing a caller states in `filter` is then applied to those rows, which is the
	 * same set the route answers.
	 */
	@Query('reports')
	async reports(
		@Args('organizationId', { type: () => ID, nullable: true }) organizationId?: Id,
		@Args('filter') filter?: ConnectionFilter,
		@Args('sort') sort?: ConnectionSortKey[],
		@Args('page') page?: ConnectionPageRequest,
		@Args('first', { type: () => Int, nullable: true }) first?: number,
		@Args('after', { type: () => String, nullable: true }) after?: string,
		@Args('last', { type: () => Int, nullable: true }) last?: number,
		@Args('before', { type: () => String, nullable: true }) before?: string,
		@Args('limit', { type: () => Int, nullable: true }) limit?: number,
		@Args('offset', { type: () => Int, nullable: true }) offset?: number
	): Promise<GraphqlConnection<Report>> {
		// The reader takes the query DTO the list route binds its query string to, with the one member
		// that route reads. This surface has no query string to bind, so the rest of the narrowing
		// arrives in `filter` and is applied below.
		const options = { organizationId } as GetReportMenuItemsInput;
		const { items }: IPagination<Report> = await this.reportService.findAllReports(options);

		return buildConnection<Report>({
			rows: items ?? [],
			filterable: REPORT_FILTERABLE,
			sortable: REPORT_SORTABLE,
			defaultSort: REPORT_DEFAULT_SORT,
			request: { filter, sort, page, first, after, last, before, limit, offset }
		});
	}

	/**
	 * The headings of the catalogue.
	 *
	 * The read is the one the category list route performs — the same service, with the route's own
	 * absence of narrowing: the route binds a `BaseQueryDTO` from its query string and hands it over,
	 * and this field hands over the same DTO with nothing stated, so the read runs with the route's
	 * defaults and the connection protocol is applied to the rows the service answered.
	 */
	@Query('reportCategories')
	async reportCategories(
		@Args('filter') filter?: ConnectionFilter,
		@Args('sort') sort?: ConnectionSortKey[],
		@Args('page') page?: ConnectionPageRequest,
		@Args('first', { type: () => Int, nullable: true }) first?: number,
		@Args('after', { type: () => String, nullable: true }) after?: string,
		@Args('last', { type: () => Int, nullable: true }) last?: number,
		@Args('before', { type: () => String, nullable: true }) before?: string,
		@Args('limit', { type: () => Int, nullable: true }) limit?: number,
		@Args('offset', { type: () => Int, nullable: true }) offset?: number
	): Promise<GraphqlConnection<ReportCategory>> {
		const options = {} as BaseQueryDTO<ReportCategory>;
		const { items }: IPagination<ReportCategory> = await this.reportCategoryService.findAll(options);

		return buildConnection<ReportCategory>({
			rows: items ?? [],
			filterable: REPORT_CATEGORY_FILTERABLE,
			sortable: REPORT_CATEGORY_SORTABLE,
			defaultSort: REPORT_CATEGORY_DEFAULT_SORT,
			request: { filter, sort, page, first, after, last, before, limit, offset }
		});
	}

	/**
	 * Switches a report on or off in an organization's menu.
	 *
	 * The write is the same service call the delivered route makes, with the same body: the method
	 * looks the menu row up by the report, the organization and the caller's tenant, saves the stated
	 * flag onto it and creates the row when there is none. Its answer is the row, which is what the
	 * route answers too — so a caller that switched a report on reads back the membership it wrote.
	 *
	 * The tenant is not among the members this input states, and the service is why: it resolves the
	 * tenant from the credential, and the row it saves is built from the body — so a caller-stated
	 * tenant would be a way to write a menu row of a tenant the caller was never asked about.
	 */
	@Mutation('updateReportMenu')
	async updateReportMenu(@Args('input') input: IUpdateReportMenuInput): Promise<ReportOrganization> {
		return await this.reportOrganizationService.updateReportMenu(input as UpdateReportMenuInput);
	}
}
