import { NotFoundException, UseGuards } from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import { Args, ID, Int, Mutation, Query, Resolver } from '@nestjs/graphql';
import { ID as Id, IDeleteTimeSlot, IGetTimeSlotInput, ITimeSlot, PermissionsEnum } from '@gauzy/contracts';
import {
	ConnectionFilter,
	ConnectionPageRequest,
	ConnectionSortKey,
	GraphqlConnection,
	buildConnection
} from '../../api/graphql-connection';
import { FeatureFlag } from '@gauzy/common';
import { Permissions } from '../../shared/decorators';
import {
	EmployeeTrackedDataGuard,
	FeatureFlagGuard,
	OrganizationPermissionGuard,
	PermissionGuard,
	TenantPermissionGuard
} from '../../shared/guards';
import { FEATURE_GRAPHQL } from '../../feature/graphql-feature.code';
import { TimeSlot } from './time-slot.entity';
import { TimeSlotService } from './time-slot.service';
import { CreateTimeSlotCommand, DeleteTimeSlotCommand, UpdateTimeSlotCommand } from './commands';

/**
 * One activity row of a slot's body, as `TimeSlotActivityInput` declares it.
 *
 * The members are the activity columns a tracker states. The employee, the organization and the tenant
 * are not among them: the delivered write stamps all three from the credential of the call, so a
 * caller stating one would be stating a scope the write overwrites. The slot's own `projectId`
 * overwrites a stated one as well, which the input's description says where it says it.
 */
export interface ITimeSlotActivityInput {
	title?: string;
	description?: string;
	metaData?: Record<string, unknown>;
	date?: string;
	time?: string;
	duration?: number;
	type?: string;
	source?: string;
	recordedAt?: Date;
	taskId?: Id;
	projectId?: Id;
}

/** The activity band the list is narrowed to, as `TimeSlotActivityLevelInput` declares it. */
export interface ITimeSlotActivityLevelInput {
	start: number;
	end: number;
}

/** The members `CreateTimeSlotInput` declares in the schema. */
export interface ICreateTimeSlotInput {
	organizationId?: Id;
	employeeId?: Id;
	projectId?: Id;
	startedAt?: Date;
	duration?: number;
	keyboard?: number;
	mouse?: number;
	overall?: number;
	location?: number;
	kbMouseActivity?: Record<string, unknown>;
	locationActivity?: Record<string, unknown>;
	customActivity?: Record<string, unknown>;
	source?: string;
	logType?: string;
	timeLogId?: Id;
	activities?: ITimeSlotActivityInput[];
}

/** The members `UpdateTimeSlotInput` declares in the schema. */
export type IUpdateTimeSlotInput = Omit<ICreateTimeSlotInput, 'timeLogId'> & { id: Id };

/**
 * The fields a slot list may be filtered and sorted by, and the order it is returned in when the
 * caller states none.
 *
 * This declaration is the resolver's half of the SDL: `TimeSlotFilter` and `TimeSlotSortField` are its
 * two renderings, and keeping the three in one file is what makes a field that is filterable in the
 * schema but unknown to the evaluator — or the reverse — impossible to introduce quietly.
 *
 * Every member is a column of the row, because that is what the delivered list read returns: it
 * selects the slot's own columns and, beside them, a projection of the organization it belongs to and
 * a projection of the employee it belongs to. The relations behind those two projections are carried
 * as the identifiers the row carries itself — `organizationId` and `employeeId` — and the partly
 * selected rows they point at are not filterable, because the connection evaluates a filter against
 * the rows the read returned and those rows carry no organization row and no employee row.
 *
 * The four derived members the type also carries are not filterable: `stoppedAt` and the three
 * percentages are computed when a row is loaded rather than stored, so narrowing by one would be
 * narrowing by a value the store never wrote.
 */
const TIME_SLOT_FILTERABLE = {
	id: 'ID',
	duration: 'NUMBER',
	keyboard: 'NUMBER',
	mouse: 'NUMBER',
	overall: 'NUMBER',
	location: 'NUMBER',
	startedAt: 'DATE',
	kbMouseActivity: 'JSON',
	locationActivity: 'JSON',
	customActivity: 'JSON',
	employeeId: 'ID',
	tenantId: 'ID',
	organizationId: 'ID',
	isActive: 'BOOLEAN',
	isArchived: 'BOOLEAN',
	deletedAt: 'DATE',
	createdAt: 'DATE',
	updatedAt: 'DATE'
} as const;

/** The fields the slot list's sort enum offers: the row's own columns a slot is read in an order for. */
const TIME_SLOT_SORTABLE = [
	'createdAt',
	'updatedAt',
	'startedAt',
	'duration',
	'keyboard',
	'mouse',
	'overall',
	'location'
] as const;

/**
 * The order the connection applies when the caller states none.
 *
 * This is not an invented order: the delivered list read fixes exactly this one — `createdAt`
 * ascending, on both of the stores the platform runs — and a connection whose default disagreed with
 * the one order the delivered read states would answer the same slots in two different sequences
 * depending on which protocol asked. The identifier is the last key so the order is total, which is
 * what a cursor names a row by: the read's own order is not total, and a walk over rows that share a
 * creation instant could neither resume nor end.
 */
const TIME_SLOT_DEFAULT_SORT: readonly ConnectionSortKey[] = [
	{ field: 'createdAt', direction: 'ASC' },
	{ field: 'id', direction: 'ASC' }
];

/**
 * The time slot over GraphQL.
 *
 * REST and GraphQL are two views of the same operations, so this resolver owns no business logic of
 * its own: every field below reaches the same `TimeSlotService` method, or dispatches the same
 * command, that the `/api/timesheet/time-slot` routes reach.
 *
 * **The guard chain and the class permissions are the controller's.** The class carries
 * `TenantPermissionGuard` and `PermissionGuard` with the three permissions `TimeSlotController`
 * carries — the tracker's own, and the two organizational ones — and every field then states the
 * permission its own route runs under, so a field is never narrower or wider than the route it
 * mirrors. The two writes are the case that reads oddly and is nevertheless the parity: their routes
 * add `OrganizationPermissionGuard` to the chain and state a permission that is not the class's, so
 * each of those two fields carries the same guard on the field itself — a method-level guard is part
 * of a resolver field's chain exactly as it is part of a route's — and the same permission. The list
 * route adds one guard of its own as well, `EmployeeTrackedDataGuard`, which is what enforces the
 * organization setting `allowEmployeeToSeeTrackedData`: while an administrator has it off, a slot is
 * one employee's tracked data — what they did, for how long, on which machine — and the route answers
 * that caller none of it. The list field carries the guard in the same place, so this surface cannot
 * serve what the route refuses. The node read is the other half of that classification: its route
 * carries no guard, because the desktop timer's screenshot retry queue reads its own slot by id and
 * must keep working while the setting is off, so the field carries none either.
 *
 * **The list is the connection and the list is where the route's narrowing lives.** The delivered
 * `GET /` route binds a query DTO and hands it to the list read; that DTO's members are this field's
 * own arguments, applied to the read itself, and the connection protocol then narrows, orders and
 * pages the rows the read returned. The members the route's validation does not admit — and the two
 * the read consults but the DTO never declares — are deliberately not arguments; each field's comment
 * below says which and why.
 *
 * **The gate is the commerce catalogue's**: `FEATURE_GRAPHQL` is the code the catalogue declares for
 * the GraphQL endpoint and its resolvers, applied once here so every field below is behind the one
 * capability. `FeatureFlagGuard` reads that code from `FEATURE_METADATA`, over the handler and then the
 * class, which is why the gate is stated on the class rather than restated on each field — and why it is
 * appended to the guard chain the routes below already carry rather than replacing any part of it.
 */
@Resolver('TimeSlot')
@UseGuards(TenantPermissionGuard, PermissionGuard, FeatureFlagGuard)
@FeatureFlag(FEATURE_GRAPHQL)
@Permissions(PermissionsEnum.TIME_TRACKER, PermissionsEnum.ALL_ORG_EDIT, PermissionsEnum.ALL_ORG_VIEW)
export class TimeSlotResolver {
	constructor(private readonly timeSlotService: TimeSlotService, private readonly commandBus: CommandBus) {}

	/**
	 * The slots one organization recorded over a range, oldest first.
	 *
	 * The read is the delivered list route's own, and its arguments are the members that route binds
	 * from its query string and hands to the read. The list read consults each one of them: the
	 * organization and the two ends of the range are the read itself, the two sets of identifiers
	 * narrow it by employee and by the project behind its logs, the two enum members narrow it by
	 * source and log type, and the activity band narrows it by the activity the slot recorded.
	 *
	 * Four members of that DTO are deliberately not arguments, and each for its own reason:
	 *
	 * - `taskIds` and `teamIds` are declared by the route's DTO and read by nothing: the delivered list
	 *   read narrows by the employee and by the project and consults neither, so a caller stating them
	 *   would be handed exactly the answer it would have been handed without them.
	 * - `syncSlots` and `onlyMe` are the reverse case: the delivered read consults both — the first
	 *   decides whether the logs it joins are narrowed to the same range as the slots, the second
	 *   narrows the answer to the caller's own employee — and the DTO the route validates against
	 *   declares neither, so the route's validation drops both before the read ever sees them. A
	 *   caller cannot state them over REST, and this surface does not offer what its route refuses.
	 *
	 * `relations` is not an argument either, for the reason every read of this resource shares: the
	 * delivered reads load the relations a caller names, and this surface's type carries no relation
	 * member for one to fill — every relation is carried as the identifier the row itself holds.
	 */
	// The list route states the tracked-data guard of its own, and the field states it in the same place:
	// these are the rows that say what one employee did and for how long, so a field without it would
	// answer a caller the route refuses.
	@Query('timeSlots')
	@UseGuards(EmployeeTrackedDataGuard)
	@Permissions(PermissionsEnum.TIME_TRACKER, PermissionsEnum.ALL_ORG_EDIT, PermissionsEnum.ALL_ORG_VIEW)
	async timeSlots(
		@Args('organizationId', { type: () => ID }) organizationId: Id,
		@Args('startDate', { type: () => Date, nullable: true }) startDate?: Date,
		@Args('endDate', { type: () => Date, nullable: true }) endDate?: Date,
		@Args('employeeIds', { type: () => [ID], nullable: true }) employeeIds?: Id[],
		@Args('projectIds', { type: () => [ID], nullable: true }) projectIds?: Id[],
		@Args('source', { type: () => [String], nullable: true }) source?: string[],
		@Args('logType', { type: () => [String], nullable: true }) logType?: string[],
		@Args('activityLevel') activityLevel?: ITimeSlotActivityLevelInput,
		@Args('filter') filter?: ConnectionFilter,
		@Args('sort') sort?: ConnectionSortKey[],
		@Args('page') page?: ConnectionPageRequest,
		@Args('first', { type: () => Int, nullable: true }) first?: number,
		@Args('after', { type: () => String, nullable: true }) after?: string,
		@Args('last', { type: () => Int, nullable: true }) last?: number,
		@Args('before', { type: () => String, nullable: true }) before?: string,
		@Args('limit', { type: () => Int, nullable: true }) limit?: number,
		@Args('offset', { type: () => Int, nullable: true }) offset?: number
	): Promise<GraphqlConnection<TimeSlot>> {
		// The query DTO is built from this field's own arguments, because a resolver has no query string
		// to bind one from. The members the delivered read defaults — an absent range, an absent source,
		// an absent band — are passed through as the caller stated them, so the call is the one the route
		// makes when its query string names exactly these.
		const rows: ITimeSlot[] = await this.timeSlotService.getTimeSlots({
			organizationId,
			startDate,
			endDate,
			employeeIds,
			projectIds,
			source,
			logType,
			activityLevel
		} as IGetTimeSlotInput);

		return buildConnection<TimeSlot>({
			rows: (rows ?? []) as TimeSlot[],
			filterable: TIME_SLOT_FILTERABLE,
			sortable: TIME_SLOT_SORTABLE,
			defaultSort: TIME_SLOT_DEFAULT_SORT,
			request: { filter, sort, page, first, after, last, before, limit, offset }
		});
	}

	/**
	 * One slot of the caller's organization.
	 *
	 * The same service method the delivered `GET /:id` route calls. That route binds its whole query
	 * string beside the path identifier and hands it to the service as the store's own find options —
	 * which is how a REST caller asks for the relations of the row — and this surface passes the
	 * identifier alone, which is the call that route makes when its query string is empty. A
	 * `relations` argument would be the other half of that statement and is deliberately absent: this
	 * surface's type carries no relation member, so the relations it loaded would be rows no member of
	 * the answer could carry.
	 *
	 * A slot that is not there answers `null` rather than a refusal: GraphQL has one answer for "no
	 * such row" on a field that may have none, and the REST route's `404` is that same fact stated in
	 * the other protocol's vocabulary.
	 */
	@Query('timeSlot')
	@Permissions(PermissionsEnum.TIME_TRACKER, PermissionsEnum.ALL_ORG_EDIT, PermissionsEnum.ALL_ORG_VIEW)
	async timeSlot(@Args('id', { type: () => ID }) id: Id): Promise<TimeSlot | null> {
		try {
			return await this.timeSlotService.findOneByIdString(id);
		} catch (error) {
			if (error instanceof NotFoundException) {
				return null;
			}

			throw error;
		}
	}

	/**
	 * Records a slot, or returns the one the instant already belongs to.
	 *
	 * The write is dispatched as the same command the delivered `POST /` route dispatches, with the
	 * same payload and the same single argument: the command's `forceDelete` flag is the second
	 * parameter of its own constructor and the route leaves it at its default, so this field leaves it
	 * there too rather than stating it a second time.
	 *
	 * The body is the route's own: the delivered handler stamps the employee, the organization and the
	 * tenant from the credential when they are absent, reads the instant the slot starts at, attaches
	 * the log the slot covers, saves the activities the tracker posted and merges the result into the
	 * ten-minute window it belongs to. None of that is restated here — the handler is the one
	 * statement of it.
	 */
	@Mutation('createTimeSlot')
	@Permissions(PermissionsEnum.TIME_TRACKER, PermissionsEnum.ALL_ORG_EDIT, PermissionsEnum.ALL_ORG_VIEW)
	async createTimeSlot(@Args('input') input: ICreateTimeSlotInput): Promise<TimeSlot> {
		return await this.commandBus.execute(new CreateTimeSlotCommand(input as unknown as ITimeSlot));
	}

	/**
	 * Edits a slot that exists.
	 *
	 * The write is dispatched as the same command the delivered `PUT /:id` route dispatches, with the
	 * same two arguments that route binds: the identifier from its path and the body. The identifier
	 * is lifted out of the input rather than passed beside the body, because that is how the route
	 * states it — in the path, not in the body — and the command carries the two separately.
	 *
	 * A caller that may not change the selected employee edits only its own slots, which the delivered
	 * handler enforces; a slot that is not there answers `null` rather than a refusal, because the
	 * handler answers nothing at all for it and inventing a refusal here would be a second answer to
	 * the same question.
	 */
	@Mutation('updateTimeSlot')
	@UseGuards(OrganizationPermissionGuard)
	@Permissions(PermissionsEnum.ALLOW_MODIFY_TIME)
	async updateTimeSlot(@Args('input') input: IUpdateTimeSlotInput): Promise<TimeSlot | null> {
		const { id, ...body } = input;

		return await this.commandBus.execute(new UpdateTimeSlotCommand(id, body as unknown as ITimeSlot));
	}

	/**
	 * Removes the slots a caller names.
	 *
	 * The write is dispatched as the same command the delivered `DELETE /` route dispatches, with the
	 * same options that route binds from its query string: the identifiers, the flag that decides
	 * whether the removal is a withdrawal or a hard delete, and the organization the rows are read
	 * under. The identifiers are required and non-empty, which is what the route's own validation
	 * states and what the delivered handler refuses without.
	 *
	 * **The tenant is deliberately not an argument.** The route's DTO admits one from its query string
	 * and the delivered handler reads it only as the fallback for the tenant the credential stamps, so
	 * in a request the credential always wins: a member here would promise a scope the write does not
	 * take. The identifier a caller chooses is the organization.
	 *
	 * The answer is the handler's own truth value. The route's declared answer is the store's result
	 * object, which is what a REST client receives and what carries the count of the rows it touched;
	 * the delivered handler returns a truth value and nothing else, so that is what this field states
	 * rather than a result object assembled here to look like the other protocol's.
	 */
	@Mutation('deleteTimeSlots')
	@UseGuards(OrganizationPermissionGuard)
	@Permissions(PermissionsEnum.ALLOW_DELETE_TIME)
	async deleteTimeSlots(
		@Args('ids', { type: () => [ID] }) ids: Id[],
		@Args('forceDelete', { type: () => Boolean, nullable: true }) forceDelete?: boolean,
		@Args('organizationId', { type: () => ID, nullable: true }) organizationId?: Id
	): Promise<boolean> {
		return await this.commandBus.execute(
			new DeleteTimeSlotCommand({ ids, forceDelete, organizationId } as unknown as IDeleteTimeSlot)
		);
	}
}
