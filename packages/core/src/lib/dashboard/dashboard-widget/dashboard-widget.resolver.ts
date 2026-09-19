import { NotFoundException, UseGuards } from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import { Args, ID, Int, Mutation, Query, Resolver } from '@nestjs/graphql';
import { FeatureFlag } from '@gauzy/common';
import {
	ID as Id,
	IDashboardWidgetCreateInput,
	IDashboardWidgetUpdateInput,
	IPagination,
	PermissionsEnum
} from '@gauzy/contracts';
import {
	ConnectionFilter,
	ConnectionPageRequest,
	ConnectionSortKey,
	GraphqlConnection,
	buildConnection
} from '../../api/graphql-connection';
import { BaseQueryDTO } from '../../core/crud';
import { FEATURE_GRAPHQL } from '../../feature/graphql-feature.code';
import { Permissions } from '../../shared/decorators';
import { FeatureFlagGuard, PermissionGuard, TenantPermissionGuard } from '../../shared/guards';
import { DashboardWidget } from './dashboard-widget.entity';
import { DashboardWidgetService } from './dashboard-widget.service';
import { DashboardWidgetCreateCommand, DashboardWidgetUpdateCommand } from './commands';

/** The members `CreateDashboardWidgetInput` declares in the schema. */
export interface ICreateDashboardWidgetInput {
	name: string;
	order?: number;
	size?: number;
	color?: string;
	isVisible?: boolean;
	options?: unknown;
	dashboardId?: Id;
	employeeId?: Id;
	projectId?: Id;
	organizationTeamId?: Id;
	organizationId?: Id;
}

/** The members `UpdateDashboardWidgetInput` declares in the schema. */
export interface IUpdateDashboardWidgetInput extends Partial<ICreateDashboardWidgetInput> {
	id: Id;
}

/**
 * The fields a widget list may be filtered and sorted by, and the order it is returned in when the
 * caller states none.
 *
 * This declaration is the resolver's half of the SDL: `DashboardWidgetFilter` and
 * `DashboardWidgetSortField` are its two renderings, and keeping the three in one file is what makes a
 * field that is filterable in the schema but unknown to the evaluator — or the reverse — impossible to
 * introduce quietly.
 *
 * `dashboardId` is the member the canvas is assembled with: the widgets of one dashboard are this one
 * list narrowed by that column, which is what keeps a dashboard's canvas and the widget list from
 * being two surfaces that can disagree. `options` is `JSON` because the settings document belongs to
 * whichever widget the placement renders.
 */
const DASHBOARD_WIDGET_FILTERABLE = {
	id: 'ID',
	name: 'STRING',
	order: 'NUMBER',
	size: 'NUMBER',
	color: 'STRING',
	isVisible: 'BOOLEAN',
	options: 'JSON',
	dashboardId: 'ID',
	employeeId: 'ID',
	projectId: 'ID',
	organizationTeamId: 'ID',
	tenantId: 'ID',
	organizationId: 'ID',
	isActive: 'BOOLEAN',
	createdAt: 'DATE',
	updatedAt: 'DATE'
} as const;

/** The fields the sort enum offers. */
const DASHBOARD_WIDGET_SORTABLE = ['createdAt', 'updatedAt', 'name', 'order', 'isVisible'] as const;

/**
 * The order the connection means when the caller states none.
 *
 * The delivered list read applies no order of its own — it hands the store the query DTO and takes the
 * rows as they come back — so this is a decision the connection has to make rather than one it
 * reproduces: `order` ascending first, because that column *is* the position a placement holds on its
 * dashboard and a canvas is read in it, then creation order, then the identifier, which is the key
 * that makes the order total and a cursor walk over it stable. A placement with no stated order sorts
 * last, which is the connection protocol's one rule for an absent value.
 */
const DASHBOARD_WIDGET_DEFAULT_SORT: readonly ConnectionSortKey[] = [
	{ field: 'order', direction: 'ASC' },
	{ field: 'createdAt', direction: 'ASC' },
	{ field: 'id', direction: 'ASC' }
];

/**
 * The dashboard widget over GraphQL.
 *
 * REST and GraphQL are two views of the same operations, so this resolver owns no business logic of
 * its own: every field below reaches the same `DashboardWidgetService` method or dispatches the same
 * command the `/api/dashboard-widget` routes reach, with the same payload. The widgets of a dashboard
 * — the read a canvas is assembled from — are this connection narrowed by `dashboardId` rather than a
 * second root field over the same rows.
 *
 * **The guard chain and the permissions are the controller's.** The class carries what the controller
 * class carries — both guards and the class-level read permission — and every field then states the
 * permission its own route runs under, so a field is never narrower or wider than the route it
 * mirrors. The four inherited routes are the case that reads oddly and is nevertheless the parity: the
 * count, the paginated spelling, the withdrawal and the restoration are delivered by the CRUD base
 * without a permission of their own, so they run under the controller's class-level *read* permission,
 * and the fields state that same permission rather than stating nothing or stating the edit permission
 * a lifecycle move would seem to deserve.
 *
 * **The gate is the catalogue's**: `FEATURE_GRAPHQL` is the code the commerce catalogue declares for
 * the GraphQL endpoint and its resolvers, applied once here so every field below is behind the one
 * capability. `FeatureFlagGuard` reads that code from `FEATURE_METADATA`, over the handler and then
 * the class, which is why the gate is stated on the class rather than restated on each field — and why
 * it is appended to the guard chain the routes below already carry rather than replacing any part of
 * it.
 */
@Resolver('DashboardWidget')
@UseGuards(TenantPermissionGuard, PermissionGuard, FeatureFlagGuard)
@FeatureFlag(FEATURE_GRAPHQL)
@Permissions(PermissionsEnum.DASHBOARD_READ)
export class DashboardWidgetResolver {
	constructor(
		private readonly dashboardWidgetService: DashboardWidgetService,
		private readonly commandBus: CommandBus
	) {}

	/**
	 * The widgets of the caller's tenant, in the order a dashboard places them.
	 */
	@Query('dashboardWidgets')
	@Permissions(PermissionsEnum.ALL_ORG_VIEW, PermissionsEnum.DASHBOARD_READ)
	async dashboardWidgets(
		@Args('filter') filter?: ConnectionFilter,
		@Args('sort') sort?: ConnectionSortKey[],
		@Args('page') page?: ConnectionPageRequest,
		@Args('first', { type: () => Int, nullable: true }) first?: number,
		@Args('after', { type: () => String, nullable: true }) after?: string,
		@Args('last', { type: () => Int, nullable: true }) last?: number,
		@Args('before', { type: () => String, nullable: true }) before?: string,
		@Args('limit', { type: () => Int, nullable: true }) limit?: number,
		@Args('offset', { type: () => Int, nullable: true }) offset?: number
	): Promise<GraphqlConnection<DashboardWidget>> {
		// The reader takes the query DTO the list route binds its query string to. This surface has no
		// query string to bind: the connection protocol states the same narrowing in `filter`, which is
		// applied to the rows the service returns, so the read runs with the route's own defaults — no
		// `where` and no relations. The tenant is applied by the service, from the credential.
		const options = {} as BaseQueryDTO<DashboardWidget>;
		const { items }: IPagination<DashboardWidget> = await this.dashboardWidgetService.findAll(options);

		return buildConnection<DashboardWidget>({
			rows: items ?? [],
			filterable: DASHBOARD_WIDGET_FILTERABLE,
			sortable: DASHBOARD_WIDGET_SORTABLE,
			defaultSort: DASHBOARD_WIDGET_DEFAULT_SORT,
			request: { filter, sort, page, first, after, last, before, limit, offset }
		});
	}

	/**
	 * One widget of the caller's tenant.
	 *
	 * A placement that is not there answers `null` rather than a refusal: GraphQL has one answer for
	 * "no such row" on a field that may have none, and the REST route's `404` is that same fact stated
	 * in the other protocol's vocabulary. The node route reads the row with the relations its query
	 * string names; this surface has no query string to bind, so the read states none.
	 */
	@Query('dashboardWidget')
	@Permissions(PermissionsEnum.ALL_ORG_VIEW, PermissionsEnum.DASHBOARD_READ)
	async dashboardWidget(@Args('id', { type: () => ID }) id: Id): Promise<DashboardWidget | null> {
		try {
			return await this.dashboardWidgetService.findOneByIdString(id);
		} catch (error) {
			if (error instanceof NotFoundException) {
				return null;
			}

			throw error;
		}
	}

	/**
	 * How many widgets the caller's tenant holds.
	 *
	 * The same call the inherited count route makes when it is given no options: that route binds its
	 * query string to the store's own `where` and hands it to `countBy`, and the connection protocol
	 * has no argument of that shape, so the field states no narrowing of its own.
	 */
	@Query('dashboardWidgetCount')
	@Permissions(PermissionsEnum.DASHBOARD_READ)
	async dashboardWidgetCount(): Promise<number | void> {
		return await this.dashboardWidgetService.countBy();
	}

	/**
	 * Places a widget on a dashboard.
	 *
	 * The write is dispatched as the same command the REST route dispatches, with the same payload, so
	 * the row, the activity-log entry the handler writes beside it and the answer are the route's own.
	 * The tenant is not among the members this input states, and the employee only places a widget for
	 * somebody else: the service stamps both from the credential, the employee falling back to the
	 * caller's own when the body names none.
	 */
	@Mutation('createDashboardWidget')
	@Permissions(PermissionsEnum.ALL_ORG_EDIT)
	async createDashboardWidget(@Args('input') input: ICreateDashboardWidgetInput): Promise<DashboardWidget> {
		return await this.commandBus.execute(
			new DashboardWidgetCreateCommand(input as unknown as IDashboardWidgetCreateInput)
		);
	}

	/**
	 * Changes a placement that exists.
	 *
	 * The delivered edit dispatches the same command as the create, carrying the identifier in the path
	 * and the body together, which is why the field states one identifier and leaves neither reading
	 * undefined. Its handler passes the body to a service that reads the row first, so a placement that
	 * is not there is answered with the miss rather than with a write under an identifier nothing owns.
	 */
	@Mutation('updateDashboardWidget')
	@Permissions(PermissionsEnum.ALL_ORG_EDIT)
	async updateDashboardWidget(@Args('input') input: IUpdateDashboardWidgetInput): Promise<DashboardWidget> {
		const { id, ...values } = input;

		return await this.commandBus.execute(
			new DashboardWidgetUpdateCommand(id, values as unknown as IDashboardWidgetUpdateInput)
		);
	}

	/**
	 * Removes a placement outright.
	 *
	 * The same service method the REST route calls. The delivered answer is the store's own delete
	 * result — a statement about the write, `{ affected }` — which is not a row and not what a field
	 * named `deleteDashboardWidget` may return; the field answers the one fact the call establishes,
	 * that the removal ran.
	 */
	@Mutation('deleteDashboardWidget')
	@Permissions(PermissionsEnum.ALL_ORG_EDIT)
	async deleteDashboardWidget(@Args('id', { type: () => ID }) id: Id): Promise<boolean> {
		await this.dashboardWidgetService.delete(id);

		return true;
	}

	/**
	 * Withdraws a placement without removing the row.
	 *
	 * The permission is the controller's class-level read permission and not the edit one, because that
	 * is what the delivered route runs under: the withdrawal is inherited from the CRUD base, where it
	 * states no permission of its own. The delivered route passes the service the empty option list it
	 * collected, so the field states none either.
	 */
	@Mutation('softDeleteDashboardWidget')
	@Permissions(PermissionsEnum.DASHBOARD_READ)
	async softDeleteDashboardWidget(@Args('id', { type: () => ID }) id: Id): Promise<DashboardWidget> {
		return await this.dashboardWidgetService.softRemove(id);
	}

	/**
	 * Puts a withdrawn placement back. Its permission is the withdrawal's, for the same reason: the
	 * delivered route carries none of its own to mirror.
	 */
	@Mutation('recoverDashboardWidget')
	@Permissions(PermissionsEnum.DASHBOARD_READ)
	async recoverDashboardWidget(@Args('id', { type: () => ID }) id: Id): Promise<DashboardWidget> {
		return await this.dashboardWidgetService.softRecover(id);
	}
}
