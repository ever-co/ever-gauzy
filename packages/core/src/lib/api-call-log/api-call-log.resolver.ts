import { UseGuards } from '@nestjs/common';
import { Args, ID, Int, Mutation, Query, Resolver } from '@nestjs/graphql';
import { ID as Id, IPagination, PermissionsEnum } from '@gauzy/contracts';
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
import { ApiCallLogFilterDTO } from './dto/api-call-log-filter.dto';
import { DeleteApiCallLogDTO } from './dto/api-call-log-delete.dto';
import { ApiCallLog } from './api-call-log.entity';
import { ApiCallLogService } from './api-call-log.service';

/**
 * The fields a call log list may be filtered and sorted by, and the order it is returned in when the
 * caller states none.
 *
 * This declaration is the resolver's half of the SDL: `ApiCallLogFilter` and `ApiCallLogSortField` are
 * its two renderings, and keeping the three in one file is what makes a field that is filterable in the
 * schema but unknown to the evaluator — or the reverse — impossible to introduce quietly.
 *
 * Every member is a column of the row, because the connection narrows the rows the delivered read
 * returned: the reader narrows by `correlationId`, `statusCode`, `ipAddress`, `method`, `userId` and a
 * `requestTime` range, and the connection is what performs the remaining narrowing over the same rows.
 * The three document members are `JSON` because that is what the columns are, and they are answered in
 * full on the same row, so filtering by one discloses nothing the row does not already carry.
 */
const API_CALL_LOG_FILTERABLE = {
	id: 'ID',
	correlationId: 'ID',
	url: 'STRING',
	method: 'STRING',
	statusCode: 'NUMBER',
	requestTime: 'DATE',
	responseTime: 'DATE',
	ipAddress: 'STRING',
	protocol: 'STRING',
	userAgent: 'STRING',
	origin: 'STRING',
	userId: 'ID',
	requestHeaders: 'JSON',
	requestBody: 'JSON',
	responseBody: 'JSON',
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
 * The two instants the row records, the two columns a triage reads by — the status and the path — the
 * method, and the row's own timestamps. Deliberately not the document columns: an order over a payload
 * is an order over the text of a document, which is not an order any caller means.
 */
const API_CALL_LOG_SORTABLE = [
	'requestTime',
	'responseTime',
	'statusCode',
	'url',
	'method',
	'createdAt',
	'updatedAt'
] as const;

/**
 * The order the connection applies when the caller states none.
 *
 * The delivered reader applies no order of its own unless the query string states one — it hands the
 * store a criterion and takes the rows as they come back — so this is a decision the connection has to
 * make rather than one it reproduces: most recent request first, because a call log is read from the end
 * that has just happened, with the identifier appended so that two calls recorded in the same
 * millisecond still have one order between them and a cursor walk over them is total.
 */
const API_CALL_LOG_DEFAULT_SORT: readonly ConnectionSortKey[] = [
	{ field: 'requestTime', direction: 'DESC' },
	{ field: 'id', direction: 'DESC' }
];

/**
 * The API call log over GraphQL.
 *
 * REST and GraphQL are two views of the same operations, so this resolver owns no business logic of its
 * own: every field below calls the same `ApiCallLogService` method the `/api/api-call-log` routes call.
 *
 * **The guard chain and the permission are the controller's.** The delivered controller carries
 * `TenantPermissionGuard` and `PermissionGuard` on its class and `API_CALL_LOG_READ` beside `ALL_ORG_VIEW`
 * on the class as well — neither route states a permission of its own — so the resolver carries the same
 * chain and states the same pair on both fields. A field that demanded less would widen the resource,
 * and one that demanded the read permission alone would narrow it below the routes it mirrors.
 *
 * **The removal is one field, not two.** The delivered route reads a `forceDelete` flag out of its query
 * string and dispatches a hard removal when it is set and a withdrawal when it is not, which is one
 * capability stated once on the route; the field therefore takes the flag as an argument rather than
 * splitting into two fields that could disagree about its default. It answers whether the removal
 * happened rather than the row, because the two branches produce two different shapes — the store's
 * delete result and the withdrawn row — and because a caller that asked for a withdrawal reads the row
 * back from the connection with its `deletedAt` set.
 *
 * **The gate is the catalogue's**: `FEATURE_GRAPHQL` is the code the commerce catalogue declares for the
 * GraphQL endpoint and its resolvers, applied once here so every field below is behind the one
 * capability. `FeatureFlagGuard` reads that code from `FEATURE_METADATA`, over the handler and then the
 * class, which is why the gate is stated on the class rather than restated on each field — and why it is
 * appended to the guard chain the routes below already carry rather than replacing any part of it.
 */
@Resolver('ApiCallLog')
@UseGuards(TenantPermissionGuard, PermissionGuard, FeatureFlagGuard)
@FeatureFlag(FEATURE_GRAPHQL)
@Permissions(PermissionsEnum.ALL_ORG_VIEW, PermissionsEnum.API_CALL_LOG_READ)
export class ApiCallLogResolver {
	constructor(private readonly apiCallLogService: ApiCallLogService) {}

	/**
	 * The API call logs of the caller's tenant, most recent request first.
	 *
	 * The reader is the one the list route calls, handed the request the route builds when its query
	 * string carries nothing: the service's own defaults then select the rows unfiltered and answer the
	 * first hundred of them. This surface has no query string to bind, so the read runs with exactly
	 * those defaults and the connection protocol's `filter` and `sort` are applied to the rows that read
	 * returned — which is the whole of what the read answers. `totalCount` is therefore the count of the
	 * rows this read answered rather than of every matching row the store holds, because the read's own
	 * page bounds the set.
	 */
	@Query('apiCallLogs')
	@Permissions(PermissionsEnum.ALL_ORG_VIEW, PermissionsEnum.API_CALL_LOG_READ)
	async apiCallLogs(
		@Args('filter') filter?: ConnectionFilter,
		@Args('sort') sort?: ConnectionSortKey[],
		@Args('page') page?: ConnectionPageRequest,
		@Args('first', { type: () => Int, nullable: true }) first?: number,
		@Args('after', { type: () => String, nullable: true }) after?: string,
		@Args('last', { type: () => Int, nullable: true }) last?: number,
		@Args('before', { type: () => String, nullable: true }) before?: string,
		@Args('limit', { type: () => Int, nullable: true }) limit?: number,
		@Args('offset', { type: () => Int, nullable: true }) offset?: number
	): Promise<GraphqlConnection<ApiCallLog>> {
		const options = {} as ApiCallLogFilterDTO;
		const { items }: IPagination<ApiCallLog> = await this.apiCallLogService.findAllLogs(options);

		return buildConnection<ApiCallLog>({
			rows: items ?? [],
			filterable: API_CALL_LOG_FILTERABLE,
			sortable: API_CALL_LOG_SORTABLE,
			defaultSort: API_CALL_LOG_DEFAULT_SORT,
			request: { filter, sort, page, first, after, last, before, limit, offset }
		});
	}

	/**
	 * Removes one recorded call, or withdraws it.
	 *
	 * The two branches are the delivered route's own, reached in the same order: the flag is read first
	 * and the service's `delete` is dispatched when it is set, its `softDelete` when it is not. The same
	 * DTO the route binds its query string to is what the flag is read out of and what travels into the
	 * criterion, so a caller asking the same question over either protocol reaches the same call with the
	 * same argument.
	 *
	 * The answer is whether the removal happened. The route answers the store's delete result on one
	 * branch and the withdrawn row on the other, and the two are not one shape a schema field can carry;
	 * the row a withdrawal produced is read back from the connection, which is where a caller that wants
	 * it was going to look anyway.
	 */
	@Mutation('deleteApiCallLog')
	@Permissions(PermissionsEnum.ALL_ORG_VIEW, PermissionsEnum.API_CALL_LOG_READ)
	async deleteApiCallLog(
		@Args('id', { type: () => ID }) id: Id,
		@Args('forceDelete', { type: () => Boolean, nullable: true }) forceDelete?: boolean
	): Promise<boolean> {
		const filters = { forceDelete: forceDelete ?? false } as DeleteApiCallLogDTO;

		// If the flag is set, the removal is hard; otherwise the row is withdrawn.
		if (filters.forceDelete) {
			await this.apiCallLogService.delete(id, { where: { ...filters } });
		} else {
			await this.apiCallLogService.softDelete(id, { where: { ...filters } });
		}

		return true;
	}
}
