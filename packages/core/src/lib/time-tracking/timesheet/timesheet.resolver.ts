import { NotFoundException, UseGuards } from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import { Args, ID, Int, Mutation, Query, Resolver } from '@nestjs/graphql';
import {
	ID as Id,
	IGetTimesheetInput,
	ISubmitTimesheetInput,
	ITimesheet,
	IUpdateTimesheetStatusInput,
	PermissionsEnum,
	TimesheetStatus
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
import { Timesheet } from './timesheet.entity';
import { TimeSheetService } from './timesheet.service';
import { TimesheetSubmitCommand, TimesheetUpdateStatusCommand } from './commands';

/**
 * The members `UpdateTimesheetStatusInput` declares in the schema.
 *
 * The delivered body also carries a `tenantId`; this surface does not offer one, because the handler
 * reads the tenant from the credential and falls back to the body only when there is none — a caller
 * stating a tenant could therefore never change the write, which is the kind of argument this
 * platform refuses to publish.
 */
export interface IUpdateTimesheetStatus {
	ids: Id[];
	status?: TimesheetStatus;
	organizationId?: Id;
}

/** The members `SubmitTimesheetInput` declares in the schema. */
export interface ISubmitTimesheet {
	ids: Id[];
	status: 'submit' | 'unsubmit';
	organizationId?: Id;
}

/**
 * The fields a timesheet list may be filtered and sorted by, and the order it is returned in when the
 * caller states none.
 *
 * This declaration is the resolver's half of the SDL: `TimesheetFilter` and `TimesheetSortField` are
 * its two renderings, and keeping the three in one file is what makes a field that is filterable in
 * the schema but unknown to the evaluator — or the reverse — impossible to introduce quietly.
 *
 * Every member is a column of the row the delivered read returns. There is no member for `employee`
 * or `organization`: the read selects a few columns of each on one store and nothing on the other,
 * so a filter on either would narrow by a value half the rows do not carry. The two relations are
 * carried as the identifiers that always travel (`employeeId`, `approvedById`), both of which are
 * filterable — which is how a caller asks for one person's timesheets, and how the read itself
 * narrows when the caller may not change the selected employee.
 */
const TIMESHEET_FILTERABLE = {
	id: 'ID',
	employeeId: 'ID',
	approvedById: 'ID',
	duration: 'NUMBER',
	keyboard: 'NUMBER',
	mouse: 'NUMBER',
	overall: 'NUMBER',
	startedAt: 'DATE',
	stoppedAt: 'DATE',
	approvedAt: 'DATE',
	submittedAt: 'DATE',
	lockedAt: 'DATE',
	editedAt: 'DATE',
	isBilled: 'BOOLEAN',
	status: 'STRING',
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
 * The fields the sort enum offers.
 *
 * Every member is a column of the row, and the set is the one an administration screen reads a
 * payroll period in an order for: the dates a timesheet is filed and settled on, the tracked totals,
 * and the two flags that say where it stands. The identifier members and the tenant are deliberately
 * absent: sorting a tenant's timesheets by who approved them is a report, and a report belongs to the
 * statistics surface rather than to this list.
 */
const TIMESHEET_SORTABLE = [
	'createdAt',
	'updatedAt',
	'startedAt',
	'stoppedAt',
	'approvedAt',
	'submittedAt',
	'lockedAt',
	'duration',
	'status',
	'isBilled'
] as const;

/**
 * The order the connection applies when the caller states none.
 *
 * The delivered list read applies no order of its own — it hands the store a criterion and takes the
 * rows as they come back — so this is a decision the connection has to make rather than one it
 * reproduces: newest first, with the identifier as the last key so that two rows filed in the same
 * millisecond still have one order between them, which is what makes a cursor walk over them stable.
 */
const TIMESHEET_DEFAULT_SORT: readonly ConnectionSortKey[] = [
	{ field: 'createdAt', direction: 'DESC' },
	{ field: 'id', direction: 'DESC' }
];

/**
 * The timesheet over GraphQL.
 *
 * REST and GraphQL are two views of the same operations, so this resolver owns no business logic of
 * its own: every field below reaches the same `TimeSheetService` method, or dispatches the same
 * command, that the `/api/timesheet` routes reach.
 *
 * **The guard chain and the class permission are the controller's.** `TimeSheetController` carries
 * `TenantPermissionGuard` and `PermissionGuard` on the class, under the timesheet-approval
 * permission, and none of its five handlers states a permission or a guard of its own — so every
 * route runs under the class's grant and every field here states the same one. That is the parity,
 * and it is the reason this class carries a `@Permissions` at all: without it a caller that may
 * approve a timesheet but holds no organizational edit would be refused a read its own route serves.
 *
 * **The delivered read already narrows by the credential, and that narrowing is not restated.** The
 * read forces the employee behind every row to be the caller's own when the caller may not change
 * the selected employee, or when the caller asks for their own rows. A resolver that turned that
 * into a permission would be a second answer to the same question, and the wrong one in both
 * directions: it would refuse the caller the route serves and serve the rows the route withholds.
 *
 * **`timesheets` states the selectors its route binds, and that is not a second filter.** The
 * delivered read narrows in the store — the organization, the two ends of the range, the statuses
 * and the employees are all part of the query it runs, and the range defaults to the current month
 * when the caller states none. A connection filter is applied to the rows a read already returned,
 * so a caller that stated the organization only in `filter` would be answered the rows of no
 * organization at all. The connection's own `filter` and `sort` then narrow that answer, which is
 * what the protocol is for; the two vocabularies overlap because the read's selectors are columns of
 * the row it returns, exactly as they do on the working-employees list of the employee domain.
 *
 * **`GET /pagination` has no root field, because this controller does not serve one.** Its list is a
 * single `GET /`, and the connection's own `limit`/`offset` are the page. The count route gets a
 * field of its own: a bare number is not a connection, and `totalCount` is not that number — it is
 * the count of the rows this connection narrowed to, while `GET /count` counts the caller's own rows
 * within the range its own query string names.
 *
 * **The gate is the catalogue's**: `FEATURE_GRAPHQL` is the code the commerce catalogue declares for
 * the GraphQL endpoint and its resolvers, applied once here so every field below is behind the one
 * capability. `FeatureFlagGuard` reads that code from `FEATURE_METADATA`, over the handler and then
 * the class, which is why the gate is stated on the class rather than restated on each field — and
 * why it is appended to the guard chain the routes below already carry rather than replacing any
 * part of it.
 */
@Resolver('Timesheet')
@UseGuards(TenantPermissionGuard, PermissionGuard, FeatureFlagGuard)
@FeatureFlag(FEATURE_GRAPHQL)
@Permissions(PermissionsEnum.CAN_APPROVE_TIMESHEET)
export class TimesheetResolver {
	constructor(private readonly timeSheetService: TimeSheetService, private readonly commandBus: CommandBus) {}

	/**
	 * The timesheets of the caller's tenant within a range, newest first.
	 *
	 * The read is the delivered list route's own, with the selectors that route binds from its query
	 * string and nothing else: the organization the rows belong to, the two ends of the range (which
	 * the read defaults to the current month), the statuses to answer and the employees to answer
	 * for. The employee narrowing the read performs from the credential stays where it is — it is the
	 * delivered scope, not a permission this field could state.
	 *
	 * `relations` is not an argument, although the delivered query DTO carries one: the read loads a
	 * relation only when the caller names it, and this surface's type carries no relation object for
	 * a loaded row to fill. An argument whose effect is invisible is worse than an argument that is
	 * absent, which is the same rule the employee resolver states for the same reason.
	 */
	@Query('timesheets')
	@Permissions(PermissionsEnum.CAN_APPROVE_TIMESHEET)
	async timesheets(
		@Args('organizationId', { type: () => ID, nullable: true })
		organizationId?: Id,
		@Args('startDate', { type: () => Date, nullable: true })
		startDate?: Date,
		@Args('endDate', { type: () => Date, nullable: true })
		endDate?: Date,
		@Args('status', { type: () => [String], nullable: true })
		status?: TimesheetStatus[],
		@Args('employeeIds', { type: () => [ID], nullable: true })
		employeeIds?: Id[],
		@Args('filter') filter?: ConnectionFilter,
		@Args('sort') sort?: ConnectionSortKey[],
		@Args('page') page?: ConnectionPageRequest,
		@Args('first', { type: () => Int, nullable: true }) first?: number,
		@Args('after', { type: () => String, nullable: true }) after?: string,
		@Args('last', { type: () => Int, nullable: true }) last?: number,
		@Args('before', { type: () => String, nullable: true }) before?: string,
		@Args('limit', { type: () => Int, nullable: true }) limit?: number,
		@Args('offset', { type: () => Int, nullable: true }) offset?: number
	): Promise<GraphqlConnection<Timesheet>> {
		// The delivered list read answers the rows themselves rather than a page envelope, on both
		// stores, which is why there is no `items` to unwrap here.
		const rows: ITimesheet[] = await this.timeSheetService.getTimeSheets({
			organizationId,
			startDate,
			endDate,
			status,
			employeeIds
		} as IGetTimesheetInput);

		return buildConnection<Timesheet>({
			rows: (rows ?? []) as Timesheet[],
			filterable: TIMESHEET_FILTERABLE,
			sortable: TIMESHEET_SORTABLE,
			defaultSort: TIMESHEET_DEFAULT_SORT,
			request: { filter, sort, page, first, after, last, before, limit, offset }
		});
	}

	/**
	 * One timesheet of the caller's tenant.
	 *
	 * The same service method the node route calls, with the same single argument: the identifier the
	 * route takes from its path. A miss answers `null` rather than a refusal — GraphQL has one answer
	 * for "no such row" on a field that may have none, and the REST route's `404` is that same fact
	 * stated in the other protocol's vocabulary.
	 */
	@Query('timesheet')
	@Permissions(PermissionsEnum.CAN_APPROVE_TIMESHEET)
	async timesheet(@Args('id', { type: () => ID }) id: Id): Promise<Timesheet | null> {
		try {
			return await this.timeSheetService.findOneByIdString(id);
		} catch (error) {
			if (error instanceof NotFoundException) {
				return null;
			}

			throw error;
		}
	}

	/**
	 * How many timesheets the caller's tenant holds within a range.
	 *
	 * The same service method the count route calls. That route binds its query string to the store's
	 * own narrowing and hands it over, and the connection protocol has no argument of that shape, so
	 * the field passes the empty request the route passes when its query string is empty — the
	 * organization and the range are then the read's own defaults, and the employee narrowing is
	 * still the one the read applies from the credential.
	 *
	 * The answer is nullable because the delivered method answers a number for the store it runs on
	 * and nothing at all when its own query fails, and a fabricated zero is a figure an operator
	 * would reconcile against a report that disagrees with it.
	 */
	@Query('timesheetCount')
	@Permissions(PermissionsEnum.CAN_APPROVE_TIMESHEET)
	async timesheetCount(): Promise<number | null> {
		const count = await this.timeSheetService.getTimeSheetCount({} as IGetTimesheetInput);

		return count ?? null;
	}

	/**
	 * Moves one or more timesheets to a new status.
	 *
	 * The write is dispatched as the same command the status route dispatches, with the same payload
	 * that route builds from its body: the identifiers to move, the status to move them to, and the
	 * organization that narrows the update. Approving records the approver and the instant, and the
	 * handler owns that — restating it here would be the copy that drifts.
	 *
	 * The answer is the rows the handler read back rather than a page of them, because the delivered
	 * route answers the rows: a client that moved five timesheets and read back four has learned
	 * something a page envelope would have hidden, which is the same reason the employee bulk create
	 * answers the rows it filed.
	 */
	@Mutation('updateTimesheetStatus')
	@Permissions(PermissionsEnum.CAN_APPROVE_TIMESHEET)
	async updateTimesheetStatus(@Args('input') input: IUpdateTimesheetStatus): Promise<Timesheet[]> {
		return await this.commandBus.execute(
			new TimesheetUpdateStatusCommand({
				ids: input.ids,
				status: input.status,
				organizationId: input.organizationId
			} as IUpdateTimesheetStatusInput)
		);
	}

	/**
	 * Submits one or more timesheets to their approver, or withdraws them again.
	 *
	 * The same command the submit route dispatches, with the same payload its body carries. The two
	 * actions are one field rather than two because the delivered write is one route whose status
	 * member selects the direction, and a client that could not tell them apart could not tell
	 * whether a period had been sent for approval.
	 */
	@Mutation('submitTimesheet')
	@Permissions(PermissionsEnum.CAN_APPROVE_TIMESHEET)
	async submitTimesheet(@Args('input') input: ISubmitTimesheet): Promise<Timesheet[]> {
		return await this.commandBus.execute(
			new TimesheetSubmitCommand({
				ids: input.ids,
				status: input.status,
				organizationId: input.organizationId
			} as ISubmitTimesheetInput)
		);
	}
}
