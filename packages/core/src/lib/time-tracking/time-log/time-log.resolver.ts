import { NotFoundException, UseGuards } from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import { Args, ID, Int, Mutation, Query, Resolver } from '@nestjs/graphql';
import { FeatureFlag } from '@gauzy/common';
import {
	IAmountOwedReport,
	IClientBudgetLimitReport,
	ID as Id,
	IDeleteTimeLog,
	IGetTimeLimitReportInput,
	IGetTimeLogConflictInput,
	IGetTimeLogReportInput,
	IManualTimeInput,
	IProjectBudgetLimitReport,
	ITimeLog,
	ITimeLimitReport,
	PermissionsEnum,
	ReportGroupFilterEnum,
	TimeLogSourceEnum,
	TimeLogType
} from '@gauzy/contracts';
import {
	ConnectionFilter,
	ConnectionPageRequest,
	ConnectionSortKey,
	GraphqlConnection,
	buildConnection
} from '../../api/graphql-connection';
import { RequestContext } from '../../core/context';
import { Permissions } from '../../shared/decorators';
import { FeatureFlagGuard, OrganizationPermissionGuard, PermissionGuard, TenantBaseGuard } from '../../shared/guards';
import { FEATURE_GRAPHQL } from '../../feature/graphql-feature.code';
import { TimeLog } from './time-log.entity';
import { TimeLogService } from './time-log.service';
import { IGetConflictTimeLogCommand } from './commands';

/**
 * The activity window `TimeLogActivityLevelInput` declares in the schema.
 *
 * Both bounds are a percentage of activity in the range 0 to 100, which is the scale the delivered
 * read takes them on: it multiplies each by six before it compares them against the ten-minute scale
 * the slot's own `overall` column is recorded on. Carried as an input of its own rather than as two
 * loose arguments because the delivered query DTO carries the pair, and a bound without its other end
 * is a window the read cannot evaluate.
 */
export interface ITimeLogActivityLevelInput {
	start: number;
	end: number;
}

/** The members `CreateManualTimeLogInput` declares in the schema. */
export interface ICreateManualTimeLogInput {
	organizationId: Id;
	employeeId: Id;
	startedAt: Date;
	stoppedAt: Date;
	projectId?: Id;
	taskId?: Id;
	organizationContactId?: Id;
	description?: string;
	reason?: string;
	isBillable?: boolean;
}

/**
 * The members `UpdateManualTimeLogInput` declares in the schema.
 *
 * The same body as the create, with the row's own identifier beside it and without the two members
 * the create's body stamps for itself — the delivered update carries neither a log type nor a source,
 * so a caller cannot restate them here either.
 */
export interface IUpdateManualTimeLogInput extends ICreateManualTimeLogInput {
	id: Id;
}

/** The members `DeleteTimeLogsInput` declares in the schema. */
export interface IDeleteTimeLogsInput {
	logIds: Id[];
	organizationId: Id;
	forceDelete?: boolean;
}

/** One line of a daily report's leaf, as `TimeLogDailyReportTask` declares it. */
export interface ITimeLogDailyReportTask {
	taskId?: Id;
	description?: string;
	duration?: number;
	clientId?: Id;
}

/** One leaf of a daily report, as `TimeLogDailyReportGroup` declares it. */
export interface ITimeLogDailyReportGroup {
	employeeId?: Id;
	projectId?: Id;
	sum?: number;
	activity?: number;
	tasks: ITimeLogDailyReportTask[];
}

/** One level of a daily report, as `TimeLogDailyReportEntry` declares it. */
export interface ITimeLogDailyReportEntry {
	date?: string;
	employeeId?: Id;
	projectId?: Id;
	clientId?: Id;
	sum?: number;
	activity?: number;
	logs: ITimeLogDailyReportEntry[];
	employeeLogs: ITimeLogDailyReportGroup[];
	projectLogs: ITimeLogDailyReportGroup[];
}

/** The four tracked figures of one day, as `TimeLogDurationBreakdown` declares them. */
export interface ITimeLogDurationBreakdown {
	tracked: number;
	manual: number;
	idle: number;
	resumed: number;
}

/** One day of the daily chart, as `TimeLogDailyReportChartPoint` declares it. */
export interface ITimeLogDailyReportChartPoint {
	date: string;
	value: ITimeLogDurationBreakdown;
}

/** One employee's line of an owed-amount day, as `TimeLogOwedAmountReportEmployee` declares it. */
export interface ITimeLogOwedAmountReportEmployee {
	employeeId?: Id;
	duration: number;
	amount: number;
}

/** One day of the owed-amount report, as `TimeLogOwedAmountReportEntry` declares it. */
export interface ITimeLogOwedAmountReportEntry {
	date: string;
	employees: ITimeLogOwedAmountReportEmployee[];
}

/** One day of the owed-amount chart, as `TimeLogOwedAmountReportChartPoint` declares it. */
export interface ITimeLogOwedAmountReportChartPoint {
	date: string;
	value: number;
}

/**
 * One log of a weekly report's day, as `TimeLogWeeklyReportLog` declares it.
 *
 * The weekly read projects four columns of each log — its identifier, the employee behind it and the
 * two instants — so this is the whole of what the member can carry and the whole of what it states.
 */
export interface ITimeLogWeeklyReportLog {
	id: Id;
	employeeId?: Id;
	startedAt?: Date;
	stoppedAt?: Date;
}

/** One day of a weekly report, as `TimeLogWeeklyReportDay` declares it. */
export interface ITimeLogWeeklyReportDay {
	date: string;
	sum: number;
	logs: ITimeLogWeeklyReportLog[];
}

/** One employee's week, as `TimeLogWeeklyReport` declares it. */
export interface ITimeLogWeeklyReport {
	employeeId?: Id;
	dates: ITimeLogWeeklyReportDay[];
	sum?: number;
	activity?: number;
}

/**
 * One employee's line of a time-limit day, as `TimeLogTimeLimitReportEmployee` declares it.
 *
 * `durationPercentage` travels as the delivered calculation produced it — a percentage rendered as a
 * two-decimal string, or the bare number zero when there is no limit to divide by. It is typed as the
 * union it is and never converted on its way through: the field's own `Float` is the number that value
 * names, and a rounding performed here would be a second figure beside the delivered one.
 */
export interface ITimeLogTimeLimitReportEmployee {
	employeeId?: Id;
	duration: number;
	durationPercentage: string | number;
	limit: number;
}

/** One day of the time-limit report, as `TimeLogTimeLimitReportEntry` declares it. */
export interface ITimeLogTimeLimitReportEntry {
	date: string;
	employees: ITimeLogTimeLimitReportEmployee[];
}

/**
 * The fields a time-log list may be filtered and sorted by, and the order it is returned in when the
 * caller states none.
 *
 * This declaration is the resolver's half of the SDL: `TimeLogFilter` and `TimeLogSortField` are its
 * two renderings, and keeping the three in one file is what makes a field that is filterable in the
 * schema but unknown to the evaluator — or the reverse — impossible to introduce quietly.
 *
 * Every member is a column of the row the delivered list read returns, and `duration` is the row's own
 * computed member — the entity fills it on load, in seconds, from the two instants. Nothing is here
 * from a relation, because the connection protocol evaluates a filter against the rows the read
 * returned: the employee, the project, the task, the client and the team are carried as the
 * identifiers that always travel, and those identifiers are filterable, which is the way to ask for
 * one person's day, one project's logs or one client's work.
 */
const TIME_LOG_FILTERABLE = {
	id: 'ID',
	startedAt: 'DATE',
	stoppedAt: 'DATE',
	editedAt: 'DATE',
	duration: 'NUMBER',
	logType: 'STRING',
	source: 'STRING',
	description: 'STRING',
	reason: 'STRING',
	isBillable: 'BOOLEAN',
	isRunning: 'BOOLEAN',
	version: 'STRING',
	isEdited: 'BOOLEAN',
	employeeId: 'ID',
	timesheetId: 'ID',
	projectId: 'ID',
	taskId: 'ID',
	organizationContactId: 'ID',
	organizationTeamId: 'ID',
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
 * Every member is a column of the row, and the set is the one a timesheet screen reads a day in an
 * order for: the instant a log starts and the instant it stops, how long it ran, when it was filed and
 * last touched, and the three members that say what kind of log it is. The identifiers are
 * deliberately absent: ordering one tenant's logs by who recorded them is a report, and this
 * resource's reports are the fields below rather than an order on its list.
 */
const TIME_LOG_SORTABLE = [
	'startedAt',
	'stoppedAt',
	'duration',
	'createdAt',
	'updatedAt',
	'logType',
	'source',
	'isBillable'
] as const;

/**
 * The order the connection applies when the caller states none.
 *
 * This one is not a decision the connection has to invent: both branches of the delivered list read
 * fix exactly this order — `order: { startedAt: 'ASC' }` on the query builder and `orderBy: { startedAt:
 * 'ASC' }` on the document store — so a client that reads the same rows over either protocol is
 * answered them in the same sequence. The identifier is the last key because a cursor names a row by
 * its position in a total order and the instant a log started is not unique: two logs of one second
 * are two rows, and without the tie-break a walk over them could visit one twice and the other never.
 */
const TIME_LOG_DEFAULT_SORT: readonly ConnectionSortKey[] = [
	{ field: 'startedAt', direction: 'ASC' },
	{ field: 'id', direction: 'ASC' }
];

/**
 * The time log over GraphQL.
 *
 * REST and GraphQL are two views of the same operations, so this resolver owns no business logic of
 * its own: every field below calls the same `TimeLogService` method, or dispatches the same command,
 * that the `/api/timesheet/time-log` routes call — with the same arguments those routes bind, built
 * from this surface's own arguments because there is no query string here to bind them from.
 *
 * **The guard chain is the controller's, and the permission of every field is the route's own.** The
 * class carries `TenantBaseGuard` and `PermissionGuard` — the two the controller class carries, in that
 * order — under the controller's own class-level grant, `TIME_TRACKER`, `ALL_ORG_EDIT` and
 * `ALL_ORG_VIEW`. That trio is the class-level statement rather than any one field's: not one read
 * handler of the delivered controller declares a permission, so every read route runs under it, and
 * the fields that mirror those routes state it here for the same reason the controller states it
 * there. The three writes are the exception and are mirrored exactly: each handler adds
 * `OrganizationPermissionGuard` to the class chain and replaces the class grant with its own single
 * permission, so each write field carries that same guard and that same permission — a field that
 * inherited the class grant instead would let a caller record time it may not record, and a field that
 * dropped the guard would skip the organization check the route performs.
 *
 * **A computed answer is a root field of its own.** Eight of the queries below are computed rather than
 * read: the daily, weekly, owed and time-limit reports, the two charts those reports are drawn from,
 * and the two budget limits. None of them is a subset of the list's rows — a per-day aggregation, a
 * rate applied to a duration and a budget spent against it are computations the connection protocol
 * cannot express, and its `filter` is evaluated against rows rather than performed on them. A ninth,
 * `timeLogConflicts`, is a row read the connection cannot express either: it selects by an interval
 * overlap, which is not a condition on either end of the row. Each states the narrowing its own
 * delivered read binds and answers a type declared for it in `schema/time-log.type.gql`.
 *
 * **The list states the members its read scopes by, and the connection's filter states the rest.** The
 * delivered list read narrows in the store rather than over its own answer: the organization is applied
 * to every query it builds, the range goes through the platform's own date-range formatter, the activity
 * window is a condition on the tracked slots the row itself does not carry, and the employee and team
 * selectors are handed to the read's own manager check. None of those can be stated as a filter over an
 * answer, so each is an argument. Every other selector the delivered query DTO carries is a column of
 * the row the read returns, which is exactly what the connection protocol evaluates a filter against —
 * so it is a member of `filter`, stated once rather than twice.
 *
 * **The gate is the catalogue's**: `FEATURE_GRAPHQL` is the code the commerce catalogue declares for
 * the GraphQL endpoint and its resolvers, applied once here so every field below is behind the one
 * capability. `FeatureFlagGuard` reads that code from `FEATURE_METADATA`, over the handler and then the
 * class, which is why the gate is stated on the class rather than restated on each field — and why it is
 * appended to the guard chain the routes below already carry rather than replacing any part of it.
 */
@Resolver('TimeLog')
@UseGuards(TenantBaseGuard, PermissionGuard, FeatureFlagGuard)
@FeatureFlag(FEATURE_GRAPHQL)
@Permissions(PermissionsEnum.TIME_TRACKER, PermissionsEnum.ALL_ORG_EDIT, PermissionsEnum.ALL_ORG_VIEW)
export class TimeLogResolver {
	constructor(private readonly timeLogService: TimeLogService, private readonly commandBus: CommandBus) {}

	/**
	 * The time logs of one organization, oldest first.
	 *
	 * The read is the delivered list route's own, with the members that route's read performs its own
	 * scoping with: the organization it cannot run without, the two ends of the range it applies
	 * together through the platform's date-range formatter, the activity window it compares against the
	 * tracked slots rather than against the row, and the employee and team selectors it hands to its own
	 * manager check — a caller that may not change the selected employee is answered the employees it
	 * manages among those it named, which is a decision the connection protocol cannot make from the
	 * rows it evaluates against.
	 *
	 * The query DTO's other selectors — `projectIds`, `taskIds`, `source`, `logType`, `timesheetId` and
	 * `isEdited` — are members of `filter` instead, and that is the same narrowing stated once: each is
	 * a column of the row the read returns, and the protocol's own operators express exactly what the
	 * store predicate expresses. Stating them a second time as arguments would be two vocabularies for
	 * one condition, and two vocabularies can come to disagree.
	 *
	 * `relations` is not an argument either, although the query DTO carries one. The read loads a
	 * relation only when the caller names it and this surface's type carries no relation object for a
	 * loaded row to fill, so an argument naming one would have an effect no answer shows. The same rule
	 * excludes `timeZone` and `groupBy`: the list read computes no calendar grouping and reads no time
	 * zone, and an argument the read ignores is worse than an argument that is absent.
	 */
	@Query('timeLogs')
	async timeLogs(
		@Args('organizationId', { type: () => ID }) organizationId: Id,
		@Args('startDate', { type: () => Date, nullable: true }) startDate?: Date,
		@Args('endDate', { type: () => Date, nullable: true }) endDate?: Date,
		@Args('employeeIds', { type: () => [ID], nullable: true }) employeeIds?: Id[],
		@Args('teamIds', { type: () => [ID], nullable: true }) teamIds?: Id[],
		@Args('activityLevel') activityLevel?: ITimeLogActivityLevelInput,
		@Args('filter') filter?: ConnectionFilter,
		@Args('sort') sort?: ConnectionSortKey[],
		@Args('page') page?: ConnectionPageRequest,
		@Args('first', { type: () => Int, nullable: true }) first?: number,
		@Args('after', { type: () => String, nullable: true }) after?: string,
		@Args('last', { type: () => Int, nullable: true }) last?: number,
		@Args('before', { type: () => String, nullable: true }) before?: string,
		@Args('limit', { type: () => Int, nullable: true }) limit?: number,
		@Args('offset', { type: () => Int, nullable: true }) offset?: number
	): Promise<GraphqlConnection<TimeLog>> {
		// The delivered list read answers the rows themselves rather than a page envelope, on both
		// stores, which is why there is no `items` to unwrap here.
		const rows: ITimeLog[] = await this.timeLogService.getTimeLogs({
			organizationId,
			startDate,
			endDate,
			employeeIds,
			teamIds,
			activityLevel
		} as IGetTimeLogReportInput);

		return buildConnection<TimeLog>({
			rows: (rows ?? []) as TimeLog[],
			filterable: TIME_LOG_FILTERABLE,
			sortable: TIME_LOG_SORTABLE,
			defaultSort: TIME_LOG_DEFAULT_SORT,
			request: { filter, sort, page, first, after, last, before, limit, offset }
		});
	}

	/**
	 * One time log of the caller's tenant.
	 *
	 * The node route reads the row with whatever relations its query string names; this surface has no
	 * query string, so the read states the empty list the route's own default is, and the object type
	 * declares no relation member for a loaded row to fill.
	 *
	 * A log that is not there answers `null` rather than a refusal: GraphQL has one answer for "no such
	 * row" on a field that may have none, and the REST route's `404` is that same fact stated in the
	 * other protocol's vocabulary.
	 */
	@Query('timeLog')
	async timeLog(@Args('id', { type: () => ID }) id: Id): Promise<TimeLog | null> {
		try {
			return (await this.timeLogService.findOneByIdString(id, { relations: [] })) as TimeLog;
		} catch (error) {
			if (error instanceof NotFoundException) {
				return null;
			}

			throw error;
		}
	}

	/**
	 * The logs that overlap a window, for one employee.
	 *
	 * A root field of its own rather than a filter of the list, because the delivered read selects by
	 * an interval overlap: it compares the two instants it is given against the two ends of every log
	 * of that employee, and the connection protocol has no operator that expresses an overlap — a
	 * `startedAt` range and a `stoppedAt` range are two conditions, and the logs this route answers are
	 * the ones either end of which falls inside the window. The command is the one the route dispatches,
	 * with the same input, and the answer is the rows it answered with: the route takes no page and
	 * performs no second narrowing, so neither does the field.
	 *
	 * The tenant is not an argument. The delivered handler reads it from the credential and falls back
	 * to the input only when there is none, so a caller stating one could never change the read.
	 */
	@Query('timeLogConflicts')
	async timeLogConflicts(
		@Args('startDate', { type: () => Date }) startDate: Date,
		@Args('endDate', { type: () => Date }) endDate: Date,
		@Args('employeeId', { type: () => ID }) employeeId: Id,
		@Args('organizationId', { type: () => ID }) organizationId: Id,
		@Args('ignoreId', { type: () => [ID], nullable: true }) ignoreId?: Id[]
	): Promise<ITimeLog[]> {
		return await this.commandBus.execute(
			new IGetConflictTimeLogCommand({
				startDate,
				endDate,
				employeeId,
				organizationId,
				...(ignoreId ? { ignoreId } : {})
			} as IGetTimeLogConflictInput)
		);
	}

	/**
	 * One report of one organization over a range, grouped by the dimension the caller names.
	 *
	 * The same service method the daily-report route calls, with the same options that route binds from
	 * its query string. `groupBy` is the member that chooses the answer's shape — the report is grouped
	 * by date, by employee, by project or by client, and the delivered handler walks one of four trees
	 * accordingly — which is why it is carried as the value the delivered enum declares and not as a
	 * schema enum: the vocabulary belongs to the contracts package, and a caller stating a value the
	 * delivered switch does not recognise is answered the date grouping, which is the delivered
	 * behaviour rather than a refusal invented here.
	 *
	 * The answer's shape is the delivered answer's own, with each nested row carried as the identifier
	 * it is read by — see `TimeLogDailyReportEntry`.
	 */
	@Query('timeLogDailyReport')
	async timeLogDailyReport(
		@Args('organizationId', { type: () => ID }) organizationId: Id,
		@Args('groupBy', { type: () => String, nullable: true }) groupBy?: ReportGroupFilterEnum,
		@Args('startDate', { type: () => Date, nullable: true }) startDate?: Date,
		@Args('endDate', { type: () => Date, nullable: true }) endDate?: Date,
		@Args('employeeIds', { type: () => [ID], nullable: true }) employeeIds?: Id[],
		@Args('projectIds', { type: () => [ID], nullable: true }) projectIds?: Id[],
		@Args('taskIds', { type: () => [ID], nullable: true }) taskIds?: Id[],
		@Args('teamIds', { type: () => [ID], nullable: true }) teamIds?: Id[],
		@Args('source', { type: () => [String], nullable: true }) source?: TimeLogSourceEnum[],
		@Args('logType', { type: () => [String], nullable: true }) logType?: TimeLogType[],
		@Args('timesheetId', { type: () => ID, nullable: true }) timesheetId?: Id,
		@Args('isEdited', { type: () => Boolean, nullable: true }) isEdited?: boolean,
		@Args('activityLevel') activityLevel?: ITimeLogActivityLevelInput,
		@Args('timeZone', { type: () => String, nullable: true }) timeZone?: string
	): Promise<ITimeLogDailyReportEntry[]> {
		const answer = await this.timeLogService.getDailyReport(
			this.reportQuery({
				organizationId,
				startDate,
				endDate,
				employeeIds,
				projectIds,
				taskIds,
				teamIds,
				source,
				logType,
				timesheetId,
				isEdited,
				activityLevel,
				timeZone,
				groupBy
			})
		);

		return this.dailyReportOf(answer);
	}

	/**
	 * The tracked, manual, idle and resumed hours of every day of a range.
	 *
	 * The same service method the daily-chart route calls, with the same options. The answer is one
	 * entry per day of the range whether or not a log was recorded on it — the delivered calculation
	 * fills an absent day with four zeroes rather than dropping it, so a chart drawn from this answer
	 * has a point for every date the caller asked about.
	 */
	@Query('timeLogDailyReportChart')
	async timeLogDailyReportChart(
		@Args('organizationId', { type: () => ID }) organizationId: Id,
		@Args('startDate', { type: () => Date, nullable: true }) startDate?: Date,
		@Args('endDate', { type: () => Date, nullable: true }) endDate?: Date,
		@Args('employeeIds', { type: () => [ID], nullable: true }) employeeIds?: Id[],
		@Args('projectIds', { type: () => [ID], nullable: true }) projectIds?: Id[],
		@Args('taskIds', { type: () => [ID], nullable: true }) taskIds?: Id[],
		@Args('teamIds', { type: () => [ID], nullable: true }) teamIds?: Id[],
		@Args('source', { type: () => [String], nullable: true }) source?: TimeLogSourceEnum[],
		@Args('logType', { type: () => [String], nullable: true }) logType?: TimeLogType[],
		@Args('timesheetId', { type: () => ID, nullable: true }) timesheetId?: Id,
		@Args('isEdited', { type: () => Boolean, nullable: true }) isEdited?: boolean,
		@Args('activityLevel') activityLevel?: ITimeLogActivityLevelInput,
		@Args('timeZone', { type: () => String, nullable: true }) timeZone?: string
	): Promise<ITimeLogDailyReportChartPoint[]> {
		const answer = await this.timeLogService.getDailyReportCharts(
			this.reportQuery({
				organizationId,
				startDate,
				endDate,
				employeeIds,
				projectIds,
				taskIds,
				teamIds,
				source,
				logType,
				timesheetId,
				isEdited,
				activityLevel,
				timeZone
			})
		);

		return (answer ?? []).map((day: Record<string, any>) => ({
			date: day.date,
			value: {
				tracked: day.value?.[TimeLogType.TRACKED] ?? 0,
				manual: day.value?.[TimeLogType.MANUAL] ?? 0,
				idle: day.value?.[TimeLogType.IDLE] ?? 0,
				resumed: day.value?.[TimeLogType.RESUMED] ?? 0
			}
		}));
	}

	/**
	 * What one organization owes its people for a range, one employee's line per day.
	 *
	 * The same service method the owed-report route calls, with the same options. The computation is
	 * the delivered one — each employee's summed duration over the day priced at the rate the read
	 * selected for them — and the field answers it rather than recomputing it: an amount multiplied a
	 * second time on this surface is an amount that can disagree with the route's own.
	 */
	@Query('timeLogOwedAmountReport')
	async timeLogOwedAmountReport(
		@Args('organizationId', { type: () => ID }) organizationId: Id,
		@Args('startDate', { type: () => Date, nullable: true }) startDate?: Date,
		@Args('endDate', { type: () => Date, nullable: true }) endDate?: Date,
		@Args('employeeIds', { type: () => [ID], nullable: true }) employeeIds?: Id[],
		@Args('projectIds', { type: () => [ID], nullable: true }) projectIds?: Id[],
		@Args('taskIds', { type: () => [ID], nullable: true }) taskIds?: Id[],
		@Args('teamIds', { type: () => [ID], nullable: true }) teamIds?: Id[],
		@Args('source', { type: () => [String], nullable: true }) source?: TimeLogSourceEnum[],
		@Args('logType', { type: () => [String], nullable: true }) logType?: TimeLogType[],
		@Args('timesheetId', { type: () => ID, nullable: true }) timesheetId?: Id,
		@Args('isEdited', { type: () => Boolean, nullable: true }) isEdited?: boolean,
		@Args('activityLevel') activityLevel?: ITimeLogActivityLevelInput,
		@Args('timeZone', { type: () => String, nullable: true }) timeZone?: string
	): Promise<ITimeLogOwedAmountReportEntry[]> {
		const answer: IAmountOwedReport[] = await this.timeLogService.getOwedAmountReport(
			this.reportQuery({
				organizationId,
				startDate,
				endDate,
				employeeIds,
				projectIds,
				taskIds,
				teamIds,
				source,
				logType,
				timesheetId,
				isEdited,
				activityLevel,
				timeZone
			})
		);

		return (answer ?? []).map((day) => ({
			date: day.date,
			employees: (day.employees ?? []).map((line) => ({
				employeeId: line.employee?.id,
				duration: line.duration,
				amount: line.amount
			}))
		}));
	}

	/**
	 * The same sums as one figure per day, for a chart.
	 *
	 * The same service method the owed-chart route calls, with the same options, and one entry per day
	 * of the range whether or not anything was worked. The two fields are deliberately two: this one
	 * answers the day's total, and the report above answers the lines that total is made of, which is
	 * the difference between a chart and the table behind it.
	 */
	@Query('timeLogOwedAmountReportChart')
	async timeLogOwedAmountReportChart(
		@Args('organizationId', { type: () => ID }) organizationId: Id,
		@Args('startDate', { type: () => Date, nullable: true }) startDate?: Date,
		@Args('endDate', { type: () => Date, nullable: true }) endDate?: Date,
		@Args('employeeIds', { type: () => [ID], nullable: true }) employeeIds?: Id[],
		@Args('projectIds', { type: () => [ID], nullable: true }) projectIds?: Id[],
		@Args('taskIds', { type: () => [ID], nullable: true }) taskIds?: Id[],
		@Args('teamIds', { type: () => [ID], nullable: true }) teamIds?: Id[],
		@Args('source', { type: () => [String], nullable: true }) source?: TimeLogSourceEnum[],
		@Args('logType', { type: () => [String], nullable: true }) logType?: TimeLogType[],
		@Args('timesheetId', { type: () => ID, nullable: true }) timesheetId?: Id,
		@Args('isEdited', { type: () => Boolean, nullable: true }) isEdited?: boolean,
		@Args('activityLevel') activityLevel?: ITimeLogActivityLevelInput,
		@Args('timeZone', { type: () => String, nullable: true }) timeZone?: string
	): Promise<ITimeLogOwedAmountReportChartPoint[]> {
		const answer = await this.timeLogService.getOwedAmountReportCharts(
			this.reportQuery({
				organizationId,
				startDate,
				endDate,
				employeeIds,
				projectIds,
				taskIds,
				teamIds,
				source,
				logType,
				timesheetId,
				isEdited,
				activityLevel,
				timeZone
			})
		);

		return (answer ?? []).map((day: Record<string, any>) => ({ date: day.date, value: day.value }));
	}

	/**
	 * One week per employee of one organization, with the activity behind the week.
	 *
	 * The same service method the weekly-report route calls, with the same options. The answer's
	 * `dates` member is reshaped in one place: the delivered calculation answers it as a map keyed by
	 * the range's own date strings whose value is either a day's group or the bare number zero for a
	 * day nothing was recorded on, and this surface answers the same days as a list — each entry
	 * carrying its date, and an absent day read as the zero it is. A map keyed by data has no GraphQL
	 * type, and the list is that same statement with the key moved into the row.
	 */
	@Query('timeLogWeeklyReport')
	async timeLogWeeklyReport(
		@Args('organizationId', { type: () => ID }) organizationId: Id,
		@Args('startDate', { type: () => Date, nullable: true }) startDate?: Date,
		@Args('endDate', { type: () => Date, nullable: true }) endDate?: Date,
		@Args('employeeIds', { type: () => [ID], nullable: true }) employeeIds?: Id[],
		@Args('projectIds', { type: () => [ID], nullable: true }) projectIds?: Id[],
		@Args('taskIds', { type: () => [ID], nullable: true }) taskIds?: Id[],
		@Args('teamIds', { type: () => [ID], nullable: true }) teamIds?: Id[],
		@Args('source', { type: () => [String], nullable: true }) source?: TimeLogSourceEnum[],
		@Args('logType', { type: () => [String], nullable: true }) logType?: TimeLogType[],
		@Args('timesheetId', { type: () => ID, nullable: true }) timesheetId?: Id,
		@Args('isEdited', { type: () => Boolean, nullable: true }) isEdited?: boolean,
		@Args('activityLevel') activityLevel?: ITimeLogActivityLevelInput,
		@Args('timeZone', { type: () => String, nullable: true }) timeZone?: string
	): Promise<ITimeLogWeeklyReport[]> {
		const answer = await this.timeLogService.getWeeklyReport(
			this.reportQuery({
				organizationId,
				startDate,
				endDate,
				employeeIds,
				projectIds,
				taskIds,
				teamIds,
				source,
				logType,
				timesheetId,
				isEdited,
				activityLevel,
				timeZone
			})
		);

		return (answer ?? []).map((week: Record<string, any>) => ({
			employeeId: week.employee?.id,
			dates: this.weekOf(week.dates),
			sum: week.sum,
			activity: week.activity
		}));
	}

	/**
	 * How much of every employee's limit a range used, one period per entry.
	 *
	 * The same service method the time-limit route calls, with the same options and the one member only
	 * that route has: the duration each entry covers. The delivered read defaults it to a day when the
	 * caller states none, which is why it is optional here rather than required — an absent value is the
	 * same request it is there. Its three known values are `day`, `week` and `month`, and the limit is
	 * the employee's weekly limit converted to whichever of them the caller named.
	 */
	@Query('timeLogTimeLimitReport')
	async timeLogTimeLimitReport(
		@Args('organizationId', { type: () => ID }) organizationId: Id,
		@Args('startDate', { type: () => Date, nullable: true }) startDate?: Date,
		@Args('endDate', { type: () => Date, nullable: true }) endDate?: Date,
		@Args('employeeIds', { type: () => [ID], nullable: true }) employeeIds?: Id[],
		@Args('projectIds', { type: () => [ID], nullable: true }) projectIds?: Id[],
		@Args('taskIds', { type: () => [ID], nullable: true }) taskIds?: Id[],
		@Args('teamIds', { type: () => [ID], nullable: true }) teamIds?: Id[],
		@Args('source', { type: () => [String], nullable: true }) source?: TimeLogSourceEnum[],
		@Args('logType', { type: () => [String], nullable: true }) logType?: TimeLogType[],
		@Args('timesheetId', { type: () => ID, nullable: true }) timesheetId?: Id,
		@Args('isEdited', { type: () => Boolean, nullable: true }) isEdited?: boolean,
		@Args('activityLevel') activityLevel?: ITimeLogActivityLevelInput,
		@Args('timeZone', { type: () => String, nullable: true }) timeZone?: string,
		@Args('duration', { type: () => String, nullable: true }) duration?: 'day' | 'week' | 'month'
	): Promise<ITimeLogTimeLimitReportEntry[]> {
		const answer: ITimeLimitReport[] = await this.timeLogService.getTimeLimit({
			...this.reportQuery({
				organizationId,
				startDate,
				endDate,
				employeeIds,
				projectIds,
				taskIds,
				teamIds,
				source,
				logType,
				timesheetId,
				isEdited,
				activityLevel,
				timeZone
			}),
			duration
		} as IGetTimeLimitReportInput);

		return (answer ?? []).map((entry: Record<string, any>) => ({
			date: entry.date,
			employees: (entry.employees ?? []).map((line: Record<string, any>) => ({
				employeeId: line.employee?.id,
				duration: line.duration,
				durationPercentage: line.durationPercentage,
				limit: line.limit
			}))
		}));
	}

	/**
	 * How much of every project's budget a range consumed.
	 *
	 * The same service method the project-budget route calls, with the same five members that route
	 * binds. That read does not go through the time-log query builder at all: it walks projects and
	 * their logs directly, so it takes the organization, the range and the two selectors it actually
	 * reads, and nothing else — the source, the log type, the timesheet, the activity window and the
	 * calendar are not members of the question it answers.
	 */
	@Query('projectBudgetLimit')
	async projectBudgetLimit(
		@Args('organizationId', { type: () => ID }) organizationId: Id,
		@Args('startDate', { type: () => Date, nullable: true }) startDate?: Date,
		@Args('endDate', { type: () => Date, nullable: true }) endDate?: Date,
		@Args('employeeIds', { type: () => [ID], nullable: true }) employeeIds?: Id[],
		@Args('projectIds', { type: () => [ID], nullable: true }) projectIds?: Id[]
	): Promise<IProjectBudgetLimitReport[]> {
		return await this.timeLogService.getProjectBudgetLimit({
			organizationId,
			startDate,
			endDate,
			employeeIds,
			projectIds
		} as IGetTimeLogReportInput);
	}

	/**
	 * How much of every client's budget a range consumed.
	 *
	 * The same service method the client-budget route calls, with the same five members: the two
	 * budgets are one computation over two different rows, and the two fields are two because a client
	 * budget and a project budget are two different questions about the same tracked time.
	 */
	@Query('clientBudgetLimit')
	async clientBudgetLimit(
		@Args('organizationId', { type: () => ID }) organizationId: Id,
		@Args('startDate', { type: () => Date, nullable: true }) startDate?: Date,
		@Args('endDate', { type: () => Date, nullable: true }) endDate?: Date,
		@Args('employeeIds', { type: () => [ID], nullable: true }) employeeIds?: Id[],
		@Args('projectIds', { type: () => [ID], nullable: true }) projectIds?: Id[]
	): Promise<IClientBudgetLimitReport[]> {
		return await this.timeLogService.getClientBudgetLimit({
			organizationId,
			startDate,
			endDate,
			employeeIds,
			projectIds
		} as IGetTimeLogReportInput);
	}

	/**
	 * Records time by hand.
	 *
	 * The same service method the create route calls, with the same body that route builds: the
	 * delivered pipe runs first and replaces the employee with the caller's own whenever the caller may
	 * not change the selected employee, and the delivered validation then states the log type and the
	 * source for itself — `MANUAL` and `BROWSER` — whatever the body carried. Both are restated here
	 * rather than left to the caller, because a write that let a caller record a tracked log against
	 * somebody else would be a wider write than the route's.
	 */
	@Mutation('addManualTime')
	@UseGuards(OrganizationPermissionGuard)
	@Permissions(PermissionsEnum.ALLOW_MANUAL_TIME)
	async addManualTime(@Args('input') input: ICreateManualTimeLogInput): Promise<ITimeLog> {
		return await this.timeLogService.addManualTime(this.createBodyOfTheCaller(input));
	}

	/**
	 * Edits a time log that was recorded by hand.
	 *
	 * The same service method the update route calls, with the identifier the route takes from its path
	 * and the body it reads — which is the create's body without the two members the delivered update
	 * does not carry, so the log type and the source it already has are left as they are. The pipe
	 * applies here too, and for the same reason: the employee is the caller's own unless the caller may
	 * choose one.
	 */
	@Mutation('updateManualTime')
	@UseGuards(OrganizationPermissionGuard)
	@Permissions(PermissionsEnum.ALLOW_MODIFY_TIME)
	async updateManualTime(@Args('input') input: IUpdateManualTimeLogInput): Promise<ITimeLog> {
		// The identifier is the criterion and is not repeated in the body, which is the shape the
		// delivered route has: `:id` names the row and the body carries only what changes.
		const { id, ...body } = input;

		return await this.timeLogService.updateManualTime(id, this.bodyOfTheCaller(body));
	}

	/**
	 * Removes time logs, outright or by withdrawal.
	 *
	 * The same service method the delete route calls, with the same three members that route binds: the
	 * rows to remove, the organization that narrows the selection, and the flag that decides whether
	 * they are deleted or withdrawn. An absent flag is read as `false`, which is the delivered body's
	 * own transform and the delivered handler's own default rather than a choice made here.
	 *
	 * The delivered answer is the store's own result — a statement about the write, `{ affected }` —
	 * which is not a row; the field answers the one fact the call establishes, that the removal ran,
	 * and a caller that needs the surviving rows reads them back through `timeLogs`.
	 */
	@Mutation('deleteTimeLogs')
	@UseGuards(OrganizationPermissionGuard)
	@Permissions(PermissionsEnum.ALLOW_DELETE_TIME)
	async deleteTimeLogs(@Args('input') input: IDeleteTimeLogsInput): Promise<boolean> {
		await this.timeLogService.deleteTimeLogs({
			logIds: input.logIds,
			organizationId: input.organizationId,
			forceDelete: input.forceDelete ?? false
		} as IDeleteTimeLog);

		return true;
	}

	/**
	 * The options object the delivered report reads take.
	 *
	 * Those reads destructure the members they use and hand the rest to the time-log query builder, so
	 * the object is built from this field's own arguments and nothing is invented for it: a member the
	 * caller did not state is absent, which is the same request the route makes when its query string
	 * omits it.
	 *
	 * @param members The members the field's own route binds.
	 * @returns The options the delivered read takes.
	 */
	private reportQuery(members: Record<string, unknown>): IGetTimeLogReportInput {
		return members as IGetTimeLogReportInput;
	}

	/**
	 * The body the delivered create route hands its service.
	 *
	 * The two members the delivered validation stamps are stated here because a GraphQL input cannot
	 * carry a class-transformer transform: the create always records a `MANUAL` log from the browser
	 * timer, whatever the caller sends, which is why neither is a member of the input type either.
	 *
	 * @param input The body the caller stated.
	 * @returns The body the delivered write reads.
	 */
	private createBodyOfTheCaller(input: ICreateManualTimeLogInput): IManualTimeInput {
		return {
			...this.bodyOfTheCaller(input),
			logType: TimeLogType.MANUAL,
			source: TimeLogSourceEnum.WEB_TIMER
		} as IManualTimeInput;
	}

	/**
	 * The body with the employee the delivered pipe leaves on it.
	 *
	 * `TimeLogBodyTransformPipe` replaces the stated employee with the caller's own whenever the caller
	 * does not hold `CHANGE_SELECTED_EMPLOYEE`, and both the create and the update route run it. It is
	 * restated rather than approximated: a caller that may record only its own time must not be able to
	 * record somebody else's by asking over this protocol, and a resolver that passed the stated
	 * identifier through would be exactly that door.
	 *
	 * @param input The body the caller stated.
	 * @returns The body with the employee the write will actually belong to.
	 */
	private bodyOfTheCaller<T extends { employeeId: Id }>(input: T): T {
		if (RequestContext.hasPermission(PermissionsEnum.CHANGE_SELECTED_EMPLOYEE)) {
			return input;
		}

		return { ...input, employeeId: RequestContext.currentEmployeeId() as Id };
	}

	/**
	 * The days of a weekly report, as this surface answers them.
	 *
	 * The delivered calculation answers the range's days as a map keyed by their own date strings, each
	 * value being either that day's group or the bare number zero when nothing was recorded. The list
	 * below is that same statement with the key moved into the entry, and an absent day read as the
	 * zero it is: the entries keep the range's own order, because the delivered calculation writes
	 * them in the order it walks the days.
	 *
	 * Each log is projected to the four columns the weekly read selected, so the member never
	 * advertises a column that is absent on every row it carries.
	 *
	 * @param dates The delivered map of the range's days.
	 * @returns One entry per day of the range.
	 */
	private weekOf(dates: Record<string, unknown> | undefined): ITimeLogWeeklyReportDay[] {
		return Object.entries(dates ?? {}).map(([date, value]) => {
			const day = typeof value === 'number' ? undefined : (value as Record<string, any>);

			return {
				date,
				sum: day?.sum ?? 0,
				logs: ((day?.logs ?? []) as ITimeLog[]).map((log) => ({
					id: log.id,
					employeeId: log.employeeId,
					startedAt: log.startedAt,
					stoppedAt: log.stoppedAt
				}))
			};
		});
	}

	/**
	 * The daily report, as this surface answers it.
	 *
	 * The delivered answer is one of four trees, chosen by the `groupBy` the caller named, and all four
	 * share one node: a level carries the dimension it was grouped by and the levels below it, and the
	 * grouping that reaches an employee carries the tasks that employee's logs describe. The recursion
	 * below is that node shape, and each nested row is carried as the identifier it is read by — the
	 * delivered read selects a handful of columns of each, so an object member here would be a
	 * partially filled row that answers null for most of itself.
	 *
	 * @param entries The delivered report.
	 * @returns The report's own tree, with each nested row carried as its identifier.
	 */
	private dailyReportOf(entries: readonly unknown[] | undefined): ITimeLogDailyReportEntry[] {
		return (entries ?? []).map((entry) => this.dailyEntryOf(entry as Record<string, any>));
	}

	/**
	 * One level of the daily report.
	 *
	 * @param entry The delivered level.
	 * @returns The level as this surface answers it.
	 */
	private dailyEntryOf(entry: Record<string, any>): ITimeLogDailyReportEntry {
		return {
			date: entry.date,
			employeeId: entry.employee?.id,
			projectId: entry.project?.id,
			clientId: entry.client?.id,
			sum: entry.sum,
			activity: entry.activity,
			logs: (entry.logs ?? []).map((one: Record<string, any>) => this.dailyEntryOf(one)),
			employeeLogs: (entry.employeeLogs ?? []).map((one: Record<string, any>) => this.dailyGroupOf(one)),
			projectLogs: (entry.projectLogs ?? []).map((one: Record<string, any>) => this.dailyGroupOf(one))
		};
	}

	/**
	 * The leaf of a daily report: one employee's task lines within the level above them.
	 *
	 * The delivered answer names this leaf `employeeLogs` in three of its four groupings and
	 * `projectLogs` in the fourth, and it carries the same figures under either name, which is why one
	 * type is declared for both fields rather than two that a client could not tell apart.
	 *
	 * @param group The delivered leaf.
	 * @returns The leaf as this surface answers it.
	 */
	private dailyGroupOf(group: Record<string, any>): ITimeLogDailyReportGroup {
		return {
			employeeId: group.employee?.id,
			projectId: group.project?.id,
			sum: group.sum,
			activity: group.activity,
			tasks: (group.tasks ?? []).map((line: Record<string, any>) => ({
				taskId: line.task?.id,
				description: line.description,
				duration: line.duration,
				clientId: line.client?.id
			}))
		};
	}
}
