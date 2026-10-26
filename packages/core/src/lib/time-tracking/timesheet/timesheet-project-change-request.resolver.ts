import { UseGuards } from '@nestjs/common';
import { Args, ID, Int, Mutation, Query, Resolver } from '@nestjs/graphql';
import {
	ID as Id,
	IRequestTimesheetProjectChange,
	ITimesheetProjectChangeRequest,
	IUpdateTimesheetProjectChangeStatus,
	PermissionsEnum,
	TimesheetProjectChangeStatus
} from '@gauzy/contracts';
import {
	ConnectionFilter,
	ConnectionPageRequest,
	ConnectionSortKey,
	GraphqlConnection,
	buildConnection
} from '../../api/graphql-connection';
import { FeatureFlag } from '@gauzy/common';
import { Permissions } from '../../shared/decorators';
import { FeatureFlagGuard, PermissionGuard, TenantPermissionGuard } from '../../shared/guards';
import { FEATURE_GRAPHQL } from '../../feature/graphql-feature.code';
import { TimesheetProjectChangeRequest } from './timesheet-project-change-request.entity';
import { TimesheetProjectChangeRequestService } from './timesheet-project-change-request.service';

/**
 * The members `RequestTimesheetProjectChangeInput` declares in the schema.
 *
 * The organization is stated and required because the delivered body requires it: the request is
 * filed against a period that belongs to one organization, and the service resolves both projects
 * inside it. There is no member for the tenant, for the same reason there is none on any other write
 * here — the service stamps it from the credential.
 */
export interface IRequestTimesheetProjectChangeInput {
	timesheetId: Id;
	requestedProjectId: Id;
	previousProjectId: Id;
	reason: string;
	organizationId: Id;
}

/**
 * The members `ReviewTimesheetProjectChangeInput` declares in the schema.
 *
 * `PENDING` is deliberately not admitted: a review always moves the request out of the pending state,
 * and the delivered body refuses it for that reason.
 */
export interface IReviewTimesheetProjectChangeInput {
	status: TimesheetProjectChangeStatus.APPROVED | TimesheetProjectChangeStatus.REJECTED;
	reviewNote?: string;
	organizationId: Id;
}

/**
 * The fields a project-change-request list may be filtered and sorted by, and the order it is returned
 * in when the caller states none.
 *
 * This declaration is the resolver's half of the SDL: `TimesheetProjectChangeRequestFilter` and
 * `TimesheetProjectChangeRequestSortField` are its two renderings, and keeping the three in one file
 * is what makes a field that is filterable in the schema but unknown to the evaluator — or the
 * reverse — impossible to introduce quietly.
 *
 * Every member is a column of the row. The three relations the entity declares — the period and the
 * two projects — are carried as the identifiers that always travel, and each is filterable, which is
 * how a caller asks for the requests of one period, of one project, or the moves one project received.
 */
const CHANGE_REQUEST_FILTERABLE = {
	id: 'ID',
	timesheetId: 'ID',
	requestedProjectId: 'ID',
	previousProjectId: 'ID',
	reviewedById: 'ID',
	status: 'STRING',
	reason: 'STRING',
	reviewNote: 'STRING',
	reviewedAt: 'DATE',
	tenantId: 'ID',
	organizationId: 'ID',
	isActive: 'BOOLEAN',
	isArchived: 'BOOLEAN',
	archivedAt: 'DATE',
	deletedAt: 'DATE',
	createdAt: 'DATE',
	updatedAt: 'DATE'
} as const;

/**
 * The fields the sort enum offers: the two instants a request is dated by and the two columns a screen
 * reads a queue in an order for.
 */
const CHANGE_REQUEST_SORTABLE = ['createdAt', 'updatedAt', 'reviewedAt', 'status'] as const;

/**
 * The order the connection applies when the caller states none.
 *
 * This is the one list on this platform whose delivered read states an order of its own: the service
 * answers the requests of a period newest first, and the connection reproduces that order rather than
 * substituting one — with the identifier as the last key, which is what makes the order total and a
 * cursor walk over it stable.
 */
const CHANGE_REQUEST_DEFAULT_SORT: readonly ConnectionSortKey[] = [
	{ field: 'createdAt', direction: 'DESC' },
	{ field: 'id', direction: 'DESC' }
];

/**
 * The timesheet project change request over GraphQL.
 *
 * REST and GraphQL are two views of the same operations, so this resolver owns no business logic of
 * its own: every field below reaches the same `TimesheetProjectChangeRequestService` method that the
 * `/api/timesheet-project-change-request` routes reach.
 *
 * **The guard chain is the controller's and the class states no permission, because the controller
 * states none.** `TimesheetProjectChangeRequestController` carries `TenantPermissionGuard` and
 * `PermissionGuard` on the class and then states a permission on each of its three handlers — raising
 * a request needs the time-tracker permission every employee already has, reading one needs either
 * that or the approval grant, and reviewing one needs the approval grant alone. Every field here
 * states the permission its own route states, read off the route's metadata rather than restated.
 *
 * **The list is a connection over the one read this resource serves, and it is a root field of its
 * own rather than a field of the period.** The delivered read is a sub-route of the period
 * (`GET /timesheet/:timesheetId`) but it is the only read this resource has, and the two values it
 * requires are part of the query the service runs: a period identifier and the organization it
 * belongs to. Both are therefore arguments of the field — a connection filter is applied to the rows
 * a read has already returned, so a caller that stated the period only in `filter` would be answered
 * the requests of no period at all.
 *
 * **What the read enforces beyond its permission is not restated here.** The service answers a caller
 * that may not approve timesheets only the requests raised against its *own* periods, and refuses the
 * rest. That is the delivered scope, not a permission this field could state: turning it into one
 * would refuse the employee the route exists for.
 *
 * **The gate is the catalogue's**: `FEATURE_GRAPHQL` is the code the commerce catalogue declares for
 * the GraphQL endpoint and its resolvers, applied once here so every field below is behind the one
 * capability. `FeatureFlagGuard` reads that code from `FEATURE_METADATA`, over the handler and then
 * the class, which is why the gate is stated on the class rather than restated on each field — and
 * why it is appended to the guard chain the routes below already carry rather than replacing any part
 * of it.
 */
@Resolver('TimesheetProjectChangeRequest')
@UseGuards(TenantPermissionGuard, PermissionGuard, FeatureFlagGuard)
@FeatureFlag(FEATURE_GRAPHQL)
export class TimesheetProjectChangeRequestResolver {
	constructor(private readonly timesheetProjectChangeRequestService: TimesheetProjectChangeRequestService) {}

	/**
	 * The project change requests raised against one period, newest first.
	 *
	 * The same service method the delivered read calls, with the same two arguments that route takes —
	 * the period from its path and the organization from its query string, both of which its validation
	 * pipe refuses when they are absent. The narrowing a caller states arrives in `filter` and is
	 * applied to the rows this call returns, which is the same set the route answers.
	 */
	@Query('timesheetProjectChangeRequests')
	@Permissions(PermissionsEnum.TIME_TRACKER, PermissionsEnum.CAN_APPROVE_TIMESHEET)
	async timesheetProjectChangeRequests(
		@Args('timesheetId', { type: () => ID }) timesheetId: Id,
		@Args('organizationId', { type: () => ID }) organizationId: Id,
		@Args('filter') filter?: ConnectionFilter,
		@Args('sort') sort?: ConnectionSortKey[],
		@Args('page') page?: ConnectionPageRequest,
		@Args('first', { type: () => Int, nullable: true }) first?: number,
		@Args('after', { type: () => String, nullable: true }) after?: string,
		@Args('last', { type: () => Int, nullable: true }) last?: number,
		@Args('before', { type: () => String, nullable: true }) before?: string,
		@Args('limit', { type: () => Int, nullable: true }) limit?: number,
		@Args('offset', { type: () => Int, nullable: true }) offset?: number
	): Promise<GraphqlConnection<TimesheetProjectChangeRequest>> {
		const rows: ITimesheetProjectChangeRequest[] =
			await this.timesheetProjectChangeRequestService.findAllByTimesheet(timesheetId, organizationId);

		return buildConnection<TimesheetProjectChangeRequest>({
			rows: (rows ?? []) as TimesheetProjectChangeRequest[],
			filterable: CHANGE_REQUEST_FILTERABLE,
			sortable: CHANGE_REQUEST_SORTABLE,
			defaultSort: CHANGE_REQUEST_DEFAULT_SORT,
			request: { filter, sort, page, first, after, last, before, limit, offset }
		});
	}

	/**
	 * Raises a request to move the time booked to one project over to another.
	 *
	 * The same service method the request route calls, with the same payload its body carries. Every
	 * check the write performs — that the caller is an employee, that the two projects differ, that the
	 * period belongs to the caller and is neither billed nor locked, that both projects are real
	 * projects of the same organization, and that only one request is pending at a time — belongs to
	 * the service and is not restated here: a second copy of any of them is the copy that drifts.
	 */
	@Mutation('requestTimesheetProjectChange')
	@Permissions(PermissionsEnum.TIME_TRACKER)
	async requestTimesheetProjectChange(
		@Args('input') input: IRequestTimesheetProjectChangeInput
	): Promise<TimesheetProjectChangeRequest> {
		return await this.timesheetProjectChangeRequestService.requestProjectChange(
			input as IRequestTimesheetProjectChange
		);
	}

	/**
	 * Approves or rejects a pending request.
	 *
	 * The same service method the review route calls, with the identifier from the route's path and the
	 * payload from its body. Approving is what actually moves the time — the service reassigns the logs
	 * booked to the previous project inside one transaction, claiming the request in a single statement
	 * so that two approvers cannot both act on it — and that is the delivered write rather than a
	 * behaviour added here.
	 */
	@Mutation('reviewTimesheetProjectChange')
	@Permissions(PermissionsEnum.CAN_APPROVE_TIMESHEET)
	async reviewTimesheetProjectChange(
		@Args('id', { type: () => ID }) id: Id,
		@Args('input') input: IReviewTimesheetProjectChangeInput
	): Promise<TimesheetProjectChangeRequest> {
		return await this.timesheetProjectChangeRequestService.review(
			id,
			input as IUpdateTimesheetProjectChangeStatus
		);
	}
}
