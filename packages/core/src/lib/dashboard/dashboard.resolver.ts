import { NotFoundException, UseGuards } from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import { Args, ID, Int, Mutation, Query, Resolver } from '@nestjs/graphql';
import { FeatureFlag } from '@gauzy/common';
import { ID as Id, IDashboardCreateInput, IDashboardUpdateInput, IPagination, PermissionsEnum } from '@gauzy/contracts';
import {
	ConnectionFilter,
	ConnectionPageRequest,
	ConnectionSortKey,
	GraphqlConnection,
	buildConnection
} from '../api/graphql-connection';
import { BaseQueryDTO } from '../core/crud';
import { FEATURE_GRAPHQL } from '../feature/graphql-feature.code';
import { Permissions } from '../shared/decorators';
import { FeatureFlagGuard, PermissionGuard, TenantPermissionGuard } from '../shared/guards';
import { Dashboard } from './dashboard.entity';
import { DashboardService } from './dashboard.service';
import { DashboardCreateCommand, DashboardUpdateCommand } from './commands';

/**
 * The members `CreateDashboardInput` declares in the schema.
 *
 * `JsonData` is carried as `unknown` rather than as a mapped type: the layout document has two
 * versions and the delivered writer stores whatever the builder produced, so a narrower type here
 * would refuse a body the REST route accepts.
 */
export interface ICreateDashboardInput {
	name: string;
	identifier: string;
	description?: string;
	contentHtml?: unknown;
	employeeId?: Id;
	organizationId?: Id;
}

/** The members `UpdateDashboardInput` declares in the schema. */
export interface IUpdateDashboardInput extends Partial<ICreateDashboardInput> {
	id: Id;
	isDefault?: boolean;
}

/**
 * The fields a dashboard list may be filtered and sorted by, and the order it is returned in when the
 * caller states none.
 *
 * This declaration is the resolver's half of the SDL: `DashboardFilter` and `DashboardSortField` are
 * its two renderings, and keeping the three in one file is what makes a field that is filterable in
 * the schema but unknown to the evaluator — or the reverse — impossible to introduce quietly.
 *
 * `contentHtml` is `JSON` because the column is a document: the filter's `contains` operator is what a
 * client asks "which dashboards place this widget" with, and the layout is where the answer is.
 * `createdByUserId` is filterable because it is what the delivered ownership check compares against —
 * a caller asking which dashboards are its own asks exactly this condition.
 */
const DASHBOARD_FILTERABLE = {
	id: 'ID',
	name: 'STRING',
	identifier: 'STRING',
	description: 'STRING',
	contentHtml: 'JSON',
	isDefault: 'BOOLEAN',
	employeeId: 'ID',
	createdByUserId: 'ID',
	tenantId: 'ID',
	organizationId: 'ID',
	isActive: 'BOOLEAN',
	createdAt: 'DATE',
	updatedAt: 'DATE'
} as const;

/** The fields the sort enum offers. */
const DASHBOARD_SORTABLE = ['createdAt', 'updatedAt', 'name', 'identifier', 'isDefault'] as const;

/**
 * The order the connection means when the caller states none.
 *
 * The delivered list read applies no order of its own — it hands the store the query DTO and takes the
 * rows as they come back — so this is a decision the connection has to make rather than one it
 * reproduces: the default dashboard first, because that is the one the caller's session opens in,
 * then newest first, then the identifier, which is the key that makes the order total and a cursor
 * walk over it stable.
 */
const DASHBOARD_DEFAULT_SORT: readonly ConnectionSortKey[] = [
	{ field: 'isDefault', direction: 'DESC' },
	{ field: 'createdAt', direction: 'DESC' },
	{ field: 'id', direction: 'DESC' }
];

/**
 * The dashboard over GraphQL.
 *
 * REST and GraphQL are two views of the same operations, so this resolver owns no business logic of
 * its own: every field below reaches the same `DashboardService` method or dispatches the same command
 * the `/api/dashboard` routes reach, with the same payload.
 *
 * **The guard chain and the permissions are the controller's.** The class carries what the controller
 * class carries — both guards and the class-level read permission — and every field then states the
 * permission its own route runs under, so a field is never narrower or wider than the route it
 * mirrors. The inherited routes are the case that reads oddly and is nevertheless the parity: the
 * count, the paginated spelling, the withdrawal and the restoration are delivered by the CRUD base
 * without a permission of their own, so they run under the controller's class-level *read*
 * permission, and the four fields state that same permission rather than stating nothing or stating
 * the edit permission a life cycle move would seem to deserve.
 *
 * **The ownership check is not restated here.** The delivered service refuses an edit or a removal to
 * anyone but the dashboard's creator, and it resolves the caller from the request context, which the
 * bootstrap mounts on the GraphQL endpoint exactly as it does on the prefixed routes — so the refusal
 * a caller meets is the service's own, raised at the same point in the write, rather than a second
 * check this surface could drift from.
 *
 * **The gate is the catalogue's**: `FEATURE_GRAPHQL` is the code the commerce catalogue declares for
 * the GraphQL endpoint and its resolvers, applied once here so every field below is behind the one
 * capability. `FeatureFlagGuard` reads that code from `FEATURE_METADATA`, over the handler and then
 * the class, which is why the gate is stated on the class rather than restated on each field — and
 * why it is appended to the guard chain the routes below already carry rather than replacing any part
 * of it.
 */
@Resolver('Dashboard')
@UseGuards(TenantPermissionGuard, PermissionGuard, FeatureFlagGuard)
@FeatureFlag(FEATURE_GRAPHQL)
@Permissions(PermissionsEnum.DASHBOARD_READ)
export class DashboardResolver {
	constructor(private readonly dashboardService: DashboardService, private readonly commandBus: CommandBus) {}

	/**
	 * The dashboards of the caller's tenant, the default one first.
	 */
	@Query('dashboards')
	@Permissions(PermissionsEnum.ALL_ORG_VIEW, PermissionsEnum.DASHBOARD_READ)
	async dashboards(
		@Args('filter') filter?: ConnectionFilter,
		@Args('sort') sort?: ConnectionSortKey[],
		@Args('page') page?: ConnectionPageRequest,
		@Args('first', { type: () => Int, nullable: true }) first?: number,
		@Args('after', { type: () => String, nullable: true }) after?: string,
		@Args('last', { type: () => Int, nullable: true }) last?: number,
		@Args('before', { type: () => String, nullable: true }) before?: string,
		@Args('limit', { type: () => Int, nullable: true }) limit?: number,
		@Args('offset', { type: () => Int, nullable: true }) offset?: number
	): Promise<GraphqlConnection<Dashboard>> {
		// The reader takes the query DTO the list route binds its query string to. This surface has no
		// query string to bind: the connection protocol states the same narrowing in `filter`, which is
		// applied to the rows the service returns, so the read runs with the route's own defaults — no
		// `where` and no relations. The tenant is applied by the service, from the credential.
		const options = {} as BaseQueryDTO<Dashboard>;
		const { items }: IPagination<Dashboard> = await this.dashboardService.findAll(options);

		return buildConnection<Dashboard>({
			rows: items ?? [],
			filterable: DASHBOARD_FILTERABLE,
			sortable: DASHBOARD_SORTABLE,
			defaultSort: DASHBOARD_DEFAULT_SORT,
			request: { filter, sort, page, first, after, last, before, limit, offset }
		});
	}

	/**
	 * One dashboard of the caller's tenant.
	 *
	 * A dashboard that is not there answers `null` rather than a refusal: GraphQL has one answer for
	 * "no such row" on a field that may have none, and the REST route's `404` is that same fact stated
	 * in the other protocol's vocabulary.
	 *
	 * The node route reads the row with the relations its query string names. This surface has no query
	 * string to bind, so the read states none and runs with the route's own defaults.
	 */
	@Query('dashboard')
	@Permissions(PermissionsEnum.ALL_ORG_VIEW, PermissionsEnum.DASHBOARD_READ)
	async dashboard(@Args('id', { type: () => ID }) id: Id): Promise<Dashboard | null> {
		try {
			return await this.dashboardService.findOneByIdString(id);
		} catch (error) {
			if (error instanceof NotFoundException) {
				return null;
			}

			throw error;
		}
	}

	/**
	 * How many dashboards the caller's tenant holds.
	 *
	 * The same call the inherited count route makes when it is given no options: that route binds its
	 * query string to the store's own `where` and hands it to `countBy`, and the connection protocol
	 * has no argument of that shape, so the field states no narrowing of its own. The tenant is applied
	 * to the criterion by the service, from the credential rather than from the caller.
	 */
	@Query('dashboardCount')
	@Permissions(PermissionsEnum.DASHBOARD_READ)
	async dashboardCount(): Promise<number | void> {
		return await this.dashboardService.countBy();
	}

	/**
	 * Creates a dashboard.
	 *
	 * The write is dispatched as the same command the REST route dispatches, with the same payload, so
	 * the row, the activity-log entry the handler writes beside it and the answer are the route's own.
	 * The tenant is not among the members this input states: the service stamps the caller's own tenant
	 * onto the row, and stating one here would promise a scope the write does not honour.
	 */
	@Mutation('createDashboard')
	@Permissions(PermissionsEnum.ALL_ORG_EDIT, PermissionsEnum.DASHBOARD_CREATE)
	async createDashboard(@Args('input') input: ICreateDashboardInput): Promise<Dashboard> {
		return await this.commandBus.execute(new DashboardCreateCommand(input as unknown as IDashboardCreateInput));
	}

	/**
	 * Changes a dashboard that exists.
	 *
	 * The delivered edit dispatches the same command as the create, carrying the identifier in the path
	 * and the body together, which is why the field states one identifier and leaves neither reading
	 * undefined. Its handler passes the body to a service that reads the row and refuses a caller who
	 * did not create it, so the refusals travel as they do over REST: `403` for another user's
	 * dashboard, `404` for one that is not there.
	 */
	@Mutation('updateDashboard')
	@Permissions(PermissionsEnum.ALL_ORG_EDIT, PermissionsEnum.DASHBOARD_UPDATE)
	async updateDashboard(@Args('input') input: IUpdateDashboardInput): Promise<Dashboard> {
		const { id, ...values } = input;

		return await this.commandBus.execute(
			new DashboardUpdateCommand(id, values as unknown as IDashboardUpdateInput)
		);
	}

	/**
	 * Removes a dashboard outright.
	 *
	 * The same service method the REST route calls. The delivered answer is the store's own delete
	 * result — a statement about the write, `{ affected }` — which is not a row and not what a field
	 * named `deleteDashboard` may return; the field answers the one fact the call establishes, that the
	 * removal ran.
	 */
	@Mutation('deleteDashboard')
	@Permissions(PermissionsEnum.ALL_ORG_EDIT, PermissionsEnum.DASHBOARD_DELETE)
	async deleteDashboard(@Args('id', { type: () => ID }) id: Id): Promise<boolean> {
		await this.dashboardService.delete(id);

		return true;
	}

	/**
	 * Withdraws a dashboard without removing the row.
	 *
	 * The permission is the controller's class-level read permission and not the edit one, because that
	 * is what the delivered route runs under: the withdrawal is inherited from the CRUD base, where it
	 * states no permission of its own. The delivered route passes the service the empty option list it
	 * collected, so the field states none either.
	 */
	@Mutation('softDeleteDashboard')
	@Permissions(PermissionsEnum.DASHBOARD_READ)
	async softDeleteDashboard(@Args('id', { type: () => ID }) id: Id): Promise<Dashboard> {
		return await this.dashboardService.softRemove(id);
	}

	/**
	 * Puts a withdrawn dashboard back. Its permission is the withdrawal's, for the same reason: the
	 * delivered route carries none of its own to mirror.
	 */
	@Mutation('recoverDashboard')
	@Permissions(PermissionsEnum.DASHBOARD_READ)
	async recoverDashboard(@Args('id', { type: () => ID }) id: Id): Promise<Dashboard> {
		return await this.dashboardService.softRecover(id);
	}
}
