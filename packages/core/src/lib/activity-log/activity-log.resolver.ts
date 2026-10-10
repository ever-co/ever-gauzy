import { UseGuards } from '@nestjs/common';
import { Args, Int, Query, Resolver } from '@nestjs/graphql';
import { IPagination } from '@gauzy/contracts';
import { FeatureFlag } from '@gauzy/common';
import {
	ConnectionFilter,
	ConnectionPageRequest,
	ConnectionSortKey,
	GraphqlConnection,
	buildConnection
} from '../api/graphql-connection';
import { Permissions } from '../shared/decorators';
import { FeatureFlagGuard, PermissionGuard, TenantPermissionGuard } from '../shared/guards';
import { FEATURE_GRAPHQL } from '../feature/graphql-feature.code';
import { GetActivityLogsDTO } from './dto/get-activity-logs.dto';
import { ActivityLog } from './activity-log.entity';
import { ActivityLogService } from './activity-log.service';

/**
 * The fields an activity log list may be filtered by, and the order it is returned in when the caller
 * states none.
 *
 * This declaration is the resolver's half of the SDL: `ActivityLogFilter` and `ActivityLogSortField`
 * are its two renderings, and keeping the three in one file is what makes a field that is filterable in
 * the schema but unknown to the evaluator — or the reverse — impossible to introduce quietly.
 *
 * Every member is a column of the log row, because the delivered reader answers the row itself and
 * joins only the relations its caller names in the query string — which this surface's read does not
 * name. The two polymorphic members are the pair that makes this a per-record history: one record's
 * timeline is the connection narrowed by `entity` and `entityId` together.
 *
 * The five document members carry the kernel's `JSON` operators, which is what the query protocol
 * offers on a document column everywhere it declares one.
 */
const ACTIVITY_LOG_FILTERABLE = {
	id: 'ID',
	entity: 'STRING',
	entityId: 'ID',
	action: 'STRING',
	actorType: 'STRING',
	description: 'STRING',
	updatedFields: 'JSON',
	previousValues: 'JSON',
	updatedValues: 'JSON',
	previousEntities: 'JSON',
	updatedEntities: 'JSON',
	data: 'JSON',
	employeeId: 'ID',
	tenantId: 'ID',
	organizationId: 'ID',
	isActive: 'BOOLEAN',
	isArchived: 'BOOLEAN',
	createdAt: 'DATE',
	updatedAt: 'DATE',
	deletedAt: 'DATE'
} as const;

/**
 * The fields the sort enum offers.
 *
 * Exactly the four the delivered reader accepts an order for — `allowedOrderFields` is that reader's
 * own list, and a value outside it is answered with `createdAt` rather than refused. Stating the same
 * four here keeps the two surfaces' order vocabularies one vocabulary: a REST caller that asks for
 * `actorType` is silently given `createdAt`, so a schema that offered the wider set would promise an
 * order the route does not apply.
 */
const ACTIVITY_LOG_SORTABLE = ['createdAt', 'updatedAt', 'entity', 'action'] as const;

/**
 * The order the connection applies when the caller states none.
 *
 * The delivered reader defaults `orderBy` to `createdAt` and `order` to `DESC`, so the connection
 * reproduces that decision rather than inventing one; the identifier is appended as the last key
 * because two rows written in the same millisecond — which a bulk update produces routinely — still
 * need one order between them for a cursor walk to be total.
 */
const ACTIVITY_LOG_DEFAULT_SORT: readonly ConnectionSortKey[] = [
	{ field: 'createdAt', direction: 'DESC' },
	{ field: 'id', direction: 'DESC' }
];

/** The members `ActivityLogFilter` declares, as the resolver's own list, for the spec to hold to. */
export const ACTIVITY_LOG_FILTER_FIELDS: readonly string[] = Object.keys(ACTIVITY_LOG_FILTERABLE);

/**
 * The activity log over GraphQL.
 *
 * REST and GraphQL are two views of the same operations, so this resolver owns no business logic of
 * its own: the one field below calls the same `ActivityLogService.findActivityLogs` the
 * `GET /api/activity-log` route calls, with the same shape of request.
 *
 * **The field states no permission, and that is the parity rather than an omission.** The delivered
 * controller carries `@Permissions()` — an empty list — on its class and states nothing on its route,
 * so its route is tenant-guarded and otherwise unpermissioned. `PermissionGuard` reads an empty list as
 * "no permission required", which is the same reading this delivery gives it; the empty list is stated
 * below rather than left off so that the parity is visible as a decision, exactly as the controller
 * states it.
 *
 * **There is one field and no more.** The controller declares one route and inherits nothing — it does
 * not extend the CRUD base — so there is no count field, no node field and no mutation between them.
 * Each of the three would be a capability with no delivered route behind it, and a log row is written
 * by the subscribers that watch the other tables rather than by any route at all.
 *
 * **The gate is the catalogue's**: `FEATURE_GRAPHQL` is the code the commerce catalogue declares for the
 * GraphQL endpoint and its resolvers, applied once here so the field below is behind the one capability.
 * `FeatureFlagGuard` reads that code from `FEATURE_METADATA`, over the handler and then the class, which
 * is why the gate is stated on the class rather than restated on the field — and why it is appended to
 * the guard chain the route below already carries rather than replacing any part of it.
 */
@Resolver('ActivityLog')
@UseGuards(TenantPermissionGuard, PermissionGuard, FeatureFlagGuard)
@FeatureFlag(FEATURE_GRAPHQL)
@Permissions()
export class ActivityLogResolver {
	constructor(private readonly activityLogService: ActivityLogService) {}

	/**
	 * The activity logs of the caller's tenant, newest first.
	 *
	 * The reader is the one the list route calls, handed the request the route builds when its query
	 * string carries nothing: the service's own defaults then select the live, unarchived rows, order
	 * them `createdAt DESC` and answer the newest hundred of them. This surface has no query string to
	 * bind, so the read runs with exactly those defaults and the connection protocol's `filter` and
	 * `sort` are applied to the rows that read returned — which is not a compromise but the whole of
	 * what the read answers. It does mean `totalCount` is the count of the rows this read answered
	 * rather than of every matching row the store holds, because the read's own page bounds the set.
	 */
	@Query('activityLogs')
	@Permissions()
	async activityLogs(
		@Args('filter') filter?: ConnectionFilter,
		@Args('sort') sort?: ConnectionSortKey[],
		@Args('page') page?: ConnectionPageRequest,
		@Args('first', { type: () => Int, nullable: true }) first?: number,
		@Args('after', { type: () => String, nullable: true }) after?: string,
		@Args('last', { type: () => Int, nullable: true }) last?: number,
		@Args('before', { type: () => String, nullable: true }) before?: string,
		@Args('limit', { type: () => Int, nullable: true }) limit?: number,
		@Args('offset', { type: () => Int, nullable: true }) offset?: number
	): Promise<GraphqlConnection<ActivityLog>> {
		const options = {} as GetActivityLogsDTO;
		const { items }: IPagination<ActivityLog> = await this.activityLogService.findActivityLogs(options);

		return buildConnection<ActivityLog>({
			rows: items ?? [],
			filterable: ACTIVITY_LOG_FILTERABLE,
			sortable: ACTIVITY_LOG_SORTABLE,
			defaultSort: ACTIVITY_LOG_DEFAULT_SORT,
			request: { filter, sort, page, first, after, last, before, limit, offset }
		});
	}
}
