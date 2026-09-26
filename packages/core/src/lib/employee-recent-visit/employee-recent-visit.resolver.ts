import { UseGuards } from '@nestjs/common';
import { Args, Int, Query, Resolver } from '@nestjs/graphql';
import { IPagination } from '@gauzy/contracts';
import {
	ConnectionFilter,
	ConnectionPageRequest,
	ConnectionSortKey,
	GraphqlConnection,
	buildConnection
} from '../api/graphql-connection';
import { FeatureFlag } from '@gauzy/common';
import { Permissions } from '../shared/decorators';
import { FeatureFlagGuard, PermissionGuard, TenantPermissionGuard } from '../shared/guards';
import { FEATURE_GRAPHQL } from '../feature/graphql-feature.code';
import { EmployeeRecentVisit } from './employee-recent-visit.entity';
import { EmployeeRecentVisitService } from './employee-recent-visit.service';
import { GetEmployeeRecentVisitsDTO } from './dto/get-employee-recent-visits.dto';

/**
 * The fields a recent-visit list may be filtered and sorted by, and the order it is returned in when
 * the caller states none.
 *
 * This declaration is the resolver's half of the SDL: `EmployeeRecentVisitFilter` and
 * `EmployeeRecentVisitSortField` are its two renderings, and keeping the three in one file is what
 * makes a field that is filterable in the schema but unknown to the evaluator — or the reverse —
 * impossible to introduce quietly.
 *
 * The first six are the narrowing the delivered route itself performs: its query DTO binds an
 * `organizationId`, an `entity`, an `entityId`, an `employeeId`, an `isActive` and an `isArchived`, and
 * the read turns the first four of those into its `where`. They are filter members here rather than root
 * fields, because a root field per narrowing would be a second surface that could disagree with this one
 * about the same rows. `skip`, `take` and `relations` — the other three members that DTO binds — are not
 * filter members at all: the first two are the page and the last is the join, and both are what the
 * connection answers with rather than what it narrows by.
 *
 * `data` is the row's own payload column and is a `JSONFilter`, which is how a caller asks after the
 * document a visit carries without a projection of its own. The identifiers and the timestamps are here
 * so an audit can name one row, one employee or one window of time.
 */
const EMPLOYEE_RECENT_VISIT_FILTERABLE = {
	id: 'ID',
	visitedAt: 'DATE',
	data: 'JSON',
	entity: 'STRING',
	entityId: 'ID',
	employeeId: 'ID',
	tenantId: 'ID',
	organizationId: 'ID',
	isActive: 'BOOLEAN',
	isArchived: 'BOOLEAN',
	createdAt: 'DATE',
	updatedAt: 'DATE'
} as const;

/** The fields the sort enum offers. */
const EMPLOYEE_RECENT_VISIT_SORTABLE = ['visitedAt', 'createdAt', 'updatedAt', 'entity'] as const;

/**
 * The order the connection applies when the caller states none.
 *
 * **This is the delivered read's own order, not one invented here.** The service fixes exactly this for
 * the rows it answers — `order: { visitedAt: 'DESC' }` — so a connection whose default disagreed with it
 * would answer the same rows in two different sequences depending on which protocol asked. The
 * identifier is the last key for the reason it always is: the order has to be total for a cursor to name
 * a row rather than a position among equals, and a caller may not sort by it.
 */
const EMPLOYEE_RECENT_VISIT_DEFAULT_SORT: readonly ConnectionSortKey[] = [
	{ field: 'visitedAt', direction: 'DESC' },
	{ field: 'id', direction: 'DESC' }
];

/**
 * The recent-visit history over GraphQL.
 *
 * REST and GraphQL are two views of the same operations, so this resolver owns no business logic of its
 * own: its one field reaches the same `EmployeeRecentVisitService.findEmployeeRecentVisits` method the
 * `/api/employee-recent-visit` route reaches.
 *
 * **The surface states a connection and nothing else, because the controller serves nothing else.** This
 * is not a CRUD controller: it declares one route, `GET /`, so there is no `GET /:id` to mirror as a node
 * query, no `GET /count` to mirror as an aggregate, and no write of any kind. A node field, a count or a
 * mutation here would be a capability REST does not have — the reverse of the gap this delivery exists to
 * close. Where a caller needs one visit it narrows the connection by `id`; where it needs a total,
 * `totalCount` is the count of the rows this read answered.
 *
 * **The read answers a bounded set, and the connection is honest about it.** The delivered read fixes its
 * own page: it takes a hundred rows unless the caller states otherwise, and its `skip` is a one-based
 * page number whose offset is `take * (skip - 1)`, so an empty DTO is the first hundred rows of the
 * caller's own history in `visitedAt` order. This field calls it with exactly that — the route's own
 * defaults, which is what the route answers a request that names none of those parameters — and the
 * connection then applies `filter`, `sort` and the page **over the rows that read returned**. That is
 * also why `totalCount` here is the count of those rows and not of every visit in the store: the total is
 * the size of the set the filters selected, and a number that pretended to count beyond the set the
 * delivered read answers would be a second, disagreeing count of the same question.
 *
 * **The guard chain and the permission are the controller's.** The delivered controller states
 * `TenantPermissionGuard` and `PermissionGuard` on the class, and beside them an empty `@Permissions()` —
 * which is a statement rather than an omission: both guards read an empty list as "no permission
 * required", so the route asks for a credential and a tenant and for no particular grant. The class here
 * therefore states the same two guards plus the gate, and the same empty permission.
 *
 * **The gate is the catalogue's**: `FEATURE_GRAPHQL` is the code the commerce catalogue declares for the
 * GraphQL endpoint and its resolvers, applied once here so the field below is behind the one capability.
 * `FeatureFlagGuard` reads that code from `FEATURE_METADATA`, over the handler and then the class, which
 * is why the gate is stated on the class — and why it is appended to the guard chain the route already
 * carries rather than replacing any part of it.
 */
@Resolver('EmployeeRecentVisit')
@UseGuards(TenantPermissionGuard, PermissionGuard, FeatureFlagGuard)
@FeatureFlag(FEATURE_GRAPHQL)
@Permissions()
export class EmployeeRecentVisitResolver {
	constructor(private readonly employeeRecentVisitService: EmployeeRecentVisitService) {}

	/**
	 * The recent visits of the caller's own employee record, most recent first.
	 */
	@Query('employeeRecentVisits')
	async employeeRecentVisits(
		@Args('filter') filter?: ConnectionFilter,
		@Args('sort') sort?: ConnectionSortKey[],
		@Args('page') page?: ConnectionPageRequest,
		@Args('first', { type: () => Int, nullable: true }) first?: number,
		@Args('after', { type: () => String, nullable: true }) after?: string,
		@Args('last', { type: () => Int, nullable: true }) last?: number,
		@Args('before', { type: () => String, nullable: true }) before?: string,
		@Args('limit', { type: () => Int, nullable: true }) limit?: number,
		@Args('offset', { type: () => Int, nullable: true }) offset?: number
	): Promise<GraphqlConnection<EmployeeRecentVisit>> {
		// The reader takes the query DTO the list route binds its query string to. This surface has no
		// query string to bind, and it does not restate the route's defaults as arguments either: an
		// empty DTO *is* the route's own defaults — no organization, no entity, no relations, the first
		// page of the read's own order — so the two protocols ask the service the same question.
		const { items }: IPagination<EmployeeRecentVisit> =
			await this.employeeRecentVisitService.findEmployeeRecentVisits({} as GetEmployeeRecentVisitsDTO);

		return buildConnection<EmployeeRecentVisit>({
			rows: items ?? [],
			filterable: EMPLOYEE_RECENT_VISIT_FILTERABLE,
			sortable: EMPLOYEE_RECENT_VISIT_SORTABLE,
			defaultSort: EMPLOYEE_RECENT_VISIT_DEFAULT_SORT,
			request: { filter, sort, page, first, after, last, before, limit, offset }
		});
	}
}
