import {
	Injectable,
	Logger,
	BadRequestException,
	NotFoundException,
	ForbiddenException,
	ConflictException,
	NotAcceptableException,
	RequestTimeoutException,
	UnprocessableEntityException
} from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import {
	IsNull,
	Between,
	Not,
	In,
	LessThanOrEqual,
	MoreThanOrEqual,
	FindOneOptions,
	FindOptionsRelations,
	FindOptionsWhere,
	Or,
	Equal
} from 'typeorm';
import * as moment from 'moment';
import {
	TimeLogType,
	ITimerStatus,
	ITimerToggleInput,
	ITimerDiscardInput,
	IDateRange,
	TimeLogSourceEnum,
	ITimerStatusInput,
	ITimeLog,
	PermissionsEnum,
	ITimeSlot,
	IEmployee,
	IEmployeeFindInput,
	ID
} from '@gauzy/contracts';
import { isNotEmpty } from '@gauzy/utils';
import { DailyPlan, Employee, OrganizationTeam, OrganizationTeamEmployee, TimeLog } from '../../core/entities/internal';
import { RequestContext } from '../../core/context';
import {
	MultiORM,
	MultiORMEnum,
	getDateRangeFormat,
	getORMType,
	parseFindOptionsRelations,
	parseTypeORMFindToMikroOrm,
	wrapSerialize,
	validateDateRange
} from '../../core/utils';
import { assertSensitiveRelationsAllowed } from '../../core/util/sensitive-relations.helper';
import { withoutTrackedDataRelations } from '../../core/util/tracked-data-sensitive-relations.config';
import { prepareSQLQuery as p } from '../../database/database.helper';
import { EmployeeService } from '../../employee/employee.service';
import { ManagedEmployeeService } from '../../employee/managed-employee.service';
import { ITrackingTurnedOffScope } from './events/tracking-turned-off.event';
import {
	DeleteTimeSpanCommand,
	IGetConflictTimeLogCommand,
	ScheduleTimeLogEntriesCommand,
	TimeLogCreateCommand,
	TimeLogDeleteCommand,
	TimeLogUpdateCommand
} from '../time-log/commands';
import {
	assertRequiredContext,
	projectIdForEntry,
	teamIdForEntry
} from '../time-log/organization-tracking-requirements';
import { isTrackerSource, postsHeartbeatSlots } from '../time-log/tracker-source';
import { TypeOrmTimeLogRepository } from '../time-log/repository/type-orm-time-log.repository';
import { MikroOrmTimeLogRepository } from '../time-log/repository/mikro-orm-time-log.repository';
import { TypeOrmEmployeeRepository } from '../../employee/repository/type-orm-employee.repository';
import { MikroOrmEmployeeRepository } from '../../employee/repository/mikro-orm-employee.repository';
import {
	TimeLogQueryParams,
	addRelationsToQuery,
	buildCommonQueryParameters,
	buildLogQueryParameters,
	buildRunningLogQueryParameters,
	exclusiveWindowEnd,
	secondsWithinWindow
} from './timer.helper';
import { discardDisabledRefusal, discardTooLateRefusal } from './timer-discard-rule';
import {
	DAILY_PLAN_REQUIRED,
	PLAN_RULE_SOURCES,
	TASK_NOT_PLANNED,
	planDatesForStart,
	planHasTasks,
	planHoldsTask
} from './timer-plan-rule';

// Get the type of the Object-Relational Mapping (ORM) used in the application.
const ormType: MultiORM = getORMType();

/**
 * The Ever Teams clients, web and mobile. Their timer starts name a task and, in installed versions, no project, so
 * the log's project is taken from the task; the other clients keep writing what they send.
 */
const PROJECT_FROM_TASK_SOURCES: ReadonlyArray<string> = [TimeLogSourceEnum.TEAMS, TimeLogSourceEnum.MOBILE];

/**
 * The Ever Teams clients, web and mobile. They are the ones that turn tracking off per team, so only their starts
 * are held to that switch; the other clients of this API never set it and keep their behavior.
 */
const TEAM_TRACKING_SWITCH_SOURCES: ReadonlyArray<string> = [TimeLogSourceEnum.TEAMS, TimeLogSourceEnum.MOBILE];

/**
 * How long a start or a stop of an employee's timer keeps their turn, in this process, before the next one may go on
 * anyway: one that hangs holds the employee's timer this long at most, as the desktop timer's own lock does. It counts
 * from when the start or stop began, not from when the next one arrived.
 */
export const EMPLOYEE_TURN_FAILSAFE_MS = 120_000;

/** A start or a stop holding the employee's turn (`inEmployeeTurn`). */
export interface EmployeeTurn {
	/**
	 * Whether this start or stop still holds the turn. It loses it only when the next one goes on after the failsafe
	 * time (`EMPLOYEE_TURN_FAILSAFE_MS`): from then on it writes no time log, so it neither creates a second run nor
	 * ends the next one's. One that is slow while nobody waits keeps it.
	 */
	isHeld(): boolean;

	/**
	 * Throws once the turn has passed to the next start or stop (see `isHeld`).
	 *
	 * @throws RequestTimeoutException when the turn has passed.
	 */
	assertHeld(): void;
}

/** The start or stop of an employee queued last in this process (`inEmployeeTurn`). */
interface QueuedTurn {
	/** Settles once that start or stop has settled, or once it has run for the failsafe time; never rejects. */
	readonly end: Promise<void>;
	/** Called by the next start or stop as it goes on: one still running then loses the turn. */
	readonly passOn: () => void;
}

/**
 * Whether a stop or a toggle names the time log it is for. Only a missing id (`undefined` or `null`) names none. An
 * empty one, which the GraphQL `ID` input lets through where the REST body refuses it, still names a log, which is not
 * the running one: the stop is refused instead of ending whatever runs.
 */
function isTimeLogNamed(input: ITimerToggleInput): boolean {
	return input.timeLogId !== undefined && input.timeLogId !== null;
}

@Injectable()
export class TimerService {
	private readonly logger = new Logger(TimerService.name);

	protected ormType: MultiORM = ormType;

	constructor(
		readonly typeOrmTimeLogRepository: TypeOrmTimeLogRepository,
		readonly mikroOrmTimeLogRepository: MikroOrmTimeLogRepository,
		readonly typeOrmEmployeeRepository: TypeOrmEmployeeRepository,
		readonly mikroOrmEmployeeRepository: MikroOrmEmployeeRepository,
		private readonly _employeeService: EmployeeService,
		private readonly _commandBus: CommandBus,
		private readonly _managedEmployeeService: ManagedEmployeeService
	) {}

	/**
	 * Fetches an employee based on the provided query.
	 *
	 * @param query - The query parameters to find the employee.
	 * @returns A Promise resolving to the employee entity or null.
	 */
	async fetchEmployee(query: IEmployeeFindInput): Promise<IEmployee | null> {
		// Replace 'Employee' with your actual Employee entity type
		switch (this.ormType) {
			case MultiORMEnum.MikroORM:
				return await this.mikroOrmEmployeeRepository.findOneByOptions(query);
			case MultiORMEnum.TypeORM:
				return await this.typeOrmEmployeeRepository.findOneByOptions(query);
			default:
				throw new Error(`Not implemented for ${this.ormType}`);
		}
	}

	/**
	 * Whether a timer status request that names an employee reads that employee (true) or the caller, as a request
	 * naming the caller themselves always did (false). A caller who may act for every employee reads anyone; a manager
	 * of the employee (ManagedEmployeeService) reads them too. Anyone else is refused: they used to get their own
	 * status back, labelled as the colleague's, with no error.
	 *
	 * @throws ForbiddenException when the caller may not read the named employee's status.
	 */
	private async readsStatusOfNamedEmployee(employeeId: ID, organizationId: ID): Promise<boolean> {
		const actsForEveryEmployee = RequestContext.hasPermission(PermissionsEnum.CHANGE_SELECTED_EMPLOYEE);
		if (actsForEveryEmployee) {
			return true;
		}

		const callerEmployeeId = RequestContext.currentEmployeeId();
		if (employeeId === callerEmployeeId) {
			return false;
		}

		const managesEmployee = await this._managedEmployeeService.canManageEmployee(
			employeeId,
			undefined,
			organizationId
		);
		if (!managesEmployee) {
			throw new ForbiddenException("You can't see this employee's timer status.");
		}
		return true;
	}

	/**
	 * Implementation of timer status logic
	 * This is intended to be used directly by the command handler
	 */
	async getTimerStatus(request: ITimerStatusInput): Promise<ITimerStatus> {
		// Builds its own query, so the check in the CRUD read methods never runs: assert the
		// sensitive-relation table on the client-supplied relations before anything is loaded.
		assertSensitiveRelationsAllowed(this.typeOrmTimeLogRepository.metadata, request.relations);

		const tenantId = RequestContext.currentTenantId() || request.tenantId;
		const { organizationId, source, todayStart, todayEnd } = request;

		let employee: IEmployee;

		const namedEmployeeId = request.employeeId;
		const namesAnEmployee = isNotEmpty(namedEmployeeId);
		let readsNamedEmployee = false;
		if (namesAnEmployee) {
			readsNamedEmployee = await this.readsStatusOfNamedEmployee(namedEmployeeId, organizationId);
		}

		if (readsNamedEmployee) {
			// Someone else's log: the tracked data hanging off it (slots, screenshots) stays out, as on the worked status
			request = { ...request, relations: withoutTrackedDataRelations(request.relations) };
			employee = await this.fetchEmployee({ id: namedEmployeeId, tenantId, organizationId });
		} else {
			const userId = RequestContext.currentUserId();
			employee = await this.fetchEmployee({ userId, tenantId, organizationId });
		}

		if (!employee) {
			throw new NotFoundException("We couldn't find the employee you were looking for.");
		}

		const { id: employeeId } = employee;

		/** The day "today" covers: the client's own day when it sends the bounds, else the server's. */
		const todayWindowStart = moment.utc(todayStart || moment().startOf('day'));
		const todayWindowEnd = moment.utc(todayEnd || moment().endOf('day'));
		const { start, end } = getDateRangeFormat(todayWindowStart, todayWindowEnd);
		// `todayEnd` is inclusive (`23:59:59.999`, or `23:59:59`); today's seconds are counted up to the exclusive end
		// after it, so a log running through the day's end counts the last second too. The queries keep `end`.
		const countedUntil = exclusiveWindowEnd(todayWindowEnd);

		let logs: TimeLog[] = [];

		// Define common parameters for querying
		const queryParams = {
			...(source ? { source } : {}),
			startedAt: Between<Date>(start as Date, end as Date),
			stoppedAt: Not(IsNull()),
			employeeId,
			tenantId,
			organizationId
		};

		// Today's completed logs are those overlapping today's window, not only those started in it: a timer that ran
		// past midnight kept its after-midnight part in today's duration while it ran (see the running log below), and
		// lost it the moment it was stopped. Each completed log is counted for its part inside the window only.
		const completedQueryParams = {
			...queryParams,
			startedAt: LessThanOrEqual<Date>(end as Date),
			stoppedAt: MoreThanOrEqual<Date>(start as Date)
		};

		switch (this.ormType) {
			case MultiORMEnum.MikroORM:
				/**
				 * Get today's completed timelogs
				 */
				const parseQueryParams = parseTypeORMFindToMikroOrm<TimeLog>(
					buildLogQueryParameters(completedQueryParams)
				);
				const items = await this.mikroOrmTimeLogRepository.findAll(parseQueryParams);
				// Optionally wrapSerialize is a function that serializes the entity
				logs = items.map((entity: TimeLog) => wrapSerialize(entity)) as TimeLog[];
				break;

			case MultiORMEnum.TypeORM:
				// Get today's completed timelogs.
				// typeorm-v1: the legacy `join` find-option was removed and `find()` rejects it at
				// runtime. `buildLogQueryParameters` still carries that inner join for the MikroORM
				// path; for TypeORM we apply it explicitly on the query builder — an inner join on
				// `timeSlots` filters to time logs that have at least one time slot.
				const completedLogQueryParams = buildLogQueryParameters(completedQueryParams);
				logs = await this.typeOrmTimeLogRepository
					.createQueryBuilder('time_log')
					.setFindOptions({ where: completedLogQueryParams.where, order: completedLogQueryParams.order })
					.innerJoin('time_log.timeSlots', 'time_slots')
					.getMany();
				break;

			default:
				throw new Error(`Not implemented for ${ormType}`);
		}

		// The running log first, whatever day it started on: a timer started before `todayStart` (one still
		// running past midnight) is the log running now, and today's window alone never found it, so the status
		// read "stopped" until the timer was stopped. Only when none runs does today's last (completed) log stand in.
		const lastLog: TimeLog | null =
			(await this.findLastTimeLog(buildRunningLogQueryParameters(queryParams), request)) ??
			(await this.findLastTimeLog(buildCommonQueryParameters(queryParams), request));

		const status: ITimerStatus = {
			duration: 0,
			running: false,
			lastLog: null
		};

		// Completed logs, each for its part inside today's window: one started yesterday counts from `todayStart`, one
		// stopped after `todayEnd` up to `todayEnd`. The running log is not among them (`isRunning: false`), and is
		// left out by id as well, so its time is counted once, below.
		const runningLogId = lastLog?.isRunning ? lastLog.id : null;
		status.duration += logs
			.filter((log) => log && log.id !== runningLogId)
			.reduce(
				(sum, log) => sum + secondsWithinWindow(log.startedAt, log.stoppedAt, todayWindowStart, countedUntil),
				0
			);

		// Calculate last TimeLog duration
		if (lastLog) {
			status.lastLog = lastLog;
			status.running = lastLog.isRunning;

			if (status.running) {
				// Today's duration holds only the part of the running log inside today's window: a timer started
				// before `todayStart` counts from `todayStart`, its earlier part belongs to the day it started on.
				// `lastLog` stays the whole log, so a client still reads the full session from its `startedAt`.
				// The same clipping as the completed logs above, so a log counts the same before and after it stops.
				status.duration += secondsWithinWindow(lastLog.startedAt, moment(), todayWindowStart, countedUntil);
			}
		}

		return status;
	}

	/**
	 * Finds the latest time log matching the query, with the relations the request asks for.
	 *
	 * @param queryParams - The query, as `buildCommonQueryParameters` / `buildRunningLogQueryParameters` build it.
	 * @param request - The timer status request, whose `relations` are loaded on the log.
	 * @returns The latest matching time log, or null when none matches.
	 */
	private async findLastTimeLog(
		queryParams: TimeLogQueryParams,
		request: ITimerStatusInput
	): Promise<TimeLog | null> {
		// Adds relations from the request to the query parameters.
		addRelationsToQuery(queryParams, request);

		switch (this.ormType) {
			case MultiORMEnum.MikroORM: {
				// Converts TypeORM-style query parameters to a format compatible with MikroORM.
				const { where, mikroOptions } = parseTypeORMFindToMikroOrm<TimeLog>(queryParams);
				return (await this.mikroOrmTimeLogRepository.findOne(where, mikroOptions)) as TimeLog;
			}
			case MultiORMEnum.TypeORM:
				return await this.typeOrmTimeLogRepository.findOne({
					...queryParams,
					relations: parseFindOptionsRelations(queryParams.relations)
				});
			default:
				throw new Error(`Not implemented for ${this.ormType}`);
		}
	}

	/**
	 * Implementation of start timer logic
	 * This is intended to be used directly by the command handler
	 */
	async startTimer(request: ITimerToggleInput): Promise<ITimeLog> {
		this.debug(() => `Start Timer Request (${moment.utc(request.startedAt).toDate()}): ${JSON.stringify(request)}`);

		// Destructure the necessary parameters from the request
		const { source, logType, taskId, organizationContactId, description, isBillable, version } = request;

		// Retrieve the tenant ID from the current context or the provided one in the request
		const tenantId = RequestContext.currentTenantId() ?? request.tenantId;

		// Determine the start date and time in UTC
		const startedAt = moment.utc(request.startedAt ?? moment.utc()).toDate();
		this.debug(() => `new timer started at: ${startedAt}`);

		// Retrieve the employee information, with the organization whose switches the start must meet
		const employee = await this.findEmployee({ organization: true });

		// Throw an exception if the employee is not found or tracking is disabled
		if (!employee.isTrackingEnabled) {
			throw new ForbiddenException(`The time tracking functionality has been disabled for you.`);
		}

		// Get the employee ID
		const { id: employeeId, organizationId } = employee;
		const requirements = employee.organization;
		const trackedEmployee = { employeeId, organizationId, tenantId };
		const manager = this.typeOrmTimeLogRepository.manager;

		const teamIdToLog = await teamIdForEntry(manager, trackedEmployee, request, requirements);

		await this.assertTrackingOnInTeam(employeeId, organizationId, tenantId, teamIdToLog, source);

		await this.assertPlannedWhenTeamRequiresIt({
			employeeId,
			organizationId,
			tenantId,
			organizationTeamId: teamIdToLog,
			taskId,
			source,
			planDay: request.planDay
		});

		const takesTaskProject = PROJECT_FROM_TASK_SOURCES.includes(source);
		const startContext = { taskId, organizationTeamId: teamIdToLog, projectId: request.projectId };
		const projectIdToLog = await projectIdForEntry(
			manager,
			trackedEmployee,
			startContext,
			requirements,
			takesTaskProject
		);

		const isTrackerStart = isTrackerSource(source);
		if (!isTrackerStart) {
			assertRequiredContext(requirements, { taskId, organizationTeamId: teamIdToLog, projectId: projectIdToLog });
		}

		// In this process, no other start or stop of the employee comes between closing the runs going and creating
		// this one (inEmployeeTurn)
		return await this.inEmployeeTurn(employeeId, async (turn) => {
			// Stop any previous running timers: one from another client ends at its last heartbeat, or where this one
			// starts when it never had one
			await this.stopPreviousRunningTimers(employeeId, organizationId, tenantId, startedAt, undefined, turn);

			// A start that took so long that the next one went on creates no run beside that one's
			turn.assertHeld();

			// Create a new time log entry using the command bus
			const timeLog = await this._commandBus.execute(
				new TimeLogCreateCommand({
					organizationId,
					tenantId,
					employeeId,
					startedAt,
					stoppedAt: startedAt,
					duration: 0,
					source: source || TimeLogSourceEnum.WEB_TIMER,
					logType: logType || TimeLogType.TRACKED,
					projectId: projectIdToLog || null,
					taskId: taskId || null,
					organizationContactId: organizationContactId || null,
					organizationTeamId: teamIdToLog || null,
					description: description || null,
					isBillable: isBillable || false,
					version: version || null,
					isRunning: true
				})
			);

			// The next start or stop went on while this run was being written, and may have read the runs going before
			// it was: the run is closed again, and that one decides the timer and the employee's status
			if (!turn.isHeld()) {
				await this.closeRunCreatedLate(timeLog, tenantId);
				turn.assertHeld();
			}

			// Update the employee's tracking status to reflect they are now tracking time
			await this._employeeService.update(employeeId, {
				isOnline: true,
				isTrackingTime: true
			});

			this.debug(() => `last created time log: ${JSON.stringify(timeLog)}`);

			// Return the newly created time log entry
			return timeLog;
		});
	}

	/**
	 * Refuses an Ever Teams start for a team that requires a daily plan when the employee has no plan with tasks
	 * for their day in that team, or when the task they start is in none of those plans. Their day is the one the
	 * client sends (see planDatesForStart), or the days around today for a client that sends none. Ever Teams web
	 * checks the same before starting; the mobile app and older web tabs did not, and the rule stayed advisory.
	 *
	 * @throws UnprocessableEntityException with the code DAILY_PLAN_REQUIRED or TASK_NOT_PLANNED.
	 */
	private async assertPlannedWhenTeamRequiresIt(start: {
		employeeId: ID;
		organizationId: ID;
		tenantId: ID;
		organizationTeamId?: ID | null;
		taskId?: ID;
		source?: TimeLogSourceEnum;
		planDay?: string;
	}): Promise<void> {
		const { employeeId, organizationId, tenantId, organizationTeamId, taskId, source, planDay } = start;
		const isPlanRuleClient = PLAN_RULE_SOURCES.includes(source);
		if (!isPlanRuleClient) {
			return;
		}
		if (!organizationTeamId) {
			return;
		}

		const team = await this.typeOrmTimeLogRepository.manager.findOne(OrganizationTeam, {
			where: { id: organizationTeamId, organizationId, tenantId },
			select: { id: true, requirePlanToTrack: true }
		});
		const teamRequiresPlan = team?.requirePlanToTrack === true;
		if (!teamRequiresPlan) {
			return;
		}

		const { from, to } = planDatesForStart(planDay, moment.utc());
		const plans = await this.typeOrmTimeLogRepository.manager.find(DailyPlan, {
			where: {
				employeeId,
				organizationTeamId,
				organizationId,
				tenantId,
				date: Between(from, to),
				isActive: Or(IsNull(), Equal(true)),
				isArchived: Or(IsNull(), Equal(false))
			},
			relations: { tasks: true }
		});
		const plansWithTasks = plans.filter(planHasTasks);
		if (plansWithTasks.length === 0) {
			throw new UnprocessableEntityException({
				message: 'Your team requires a daily plan before you track time. Plan your day first.',
				code: DAILY_PLAN_REQUIRED
			});
		}

		if (!taskId) {
			return;
		}
		const isTaskPlanned = plansWithTasks.some((plan) => planHoldsTask(plan, taskId));
		if (!isTaskPlanned) {
			throw new UnprocessableEntityException({
				message: "Add this task to today's plan before you track time on it.",
				code: TASK_NOT_PLANNED
			});
		}
	}

	/**
	 * Refuses an Ever Teams start for a team where the employee's tracking is turned off. Ever Teams hides the timer
	 * then, but an open tab from before or the mobile app could still start it.
	 *
	 * @param employeeId The employee starting the timer.
	 * @param organizationId The employee's organization.
	 * @param tenantId The caller's tenant.
	 * @param organizationTeamId The team the timer starts for, if any.
	 * @param source The client starting the timer.
	 */
	private async assertTrackingOnInTeam(
		employeeId: ID,
		organizationId: ID,
		tenantId: ID,
		organizationTeamId: ID | null | undefined,
		source: TimeLogSourceEnum | undefined
	): Promise<void> {
		const isTeamSwitchClient = TEAM_TRACKING_SWITCH_SOURCES.includes(source);
		if (!isTeamSwitchClient) {
			return;
		}
		if (!organizationTeamId) {
			return;
		}
		const membership = await this.typeOrmTimeLogRepository.manager.findOne(OrganizationTeamEmployee, {
			// A membership left inactive or archived no longer ties the employee to the team (NULL counts as current)
			where: {
				employeeId,
				organizationTeamId,
				organizationId,
				tenantId,
				isActive: Or(IsNull(), Equal(true)),
				isArchived: Or(IsNull(), Equal(false))
			},
			select: { id: true, isTrackingEnabled: true }
		});
		const isTrackingOffInTeam = membership?.isTrackingEnabled === false;
		if (isTrackingOffInTeam) {
			throw new ForbiddenException('Time tracking is turned off for you in this team.');
		}
	}

	/**
	 * Implementation of stop timer logic
	 * This is intended to be used directly by the command handler
	 */
	async stopTimer(request: ITimerToggleInput): Promise<ITimeLog> {
		this.debug(() => `Stop Timer Request (${moment.utc(request.stoppedAt).toDate()}): ${JSON.stringify(request)}`);

		// Validate the date range and check if the timer is running
		validateDateRange(request.startedAt, request.stoppedAt);

		// When the stop arrived: a stop that names no time ends the run here, not after it waited for its turn
		const receivedAt = moment.utc().toDate();

		// Fetch the employee details. Turning tracking off does not refuse the stop: a timer still running when an
		// admin turned it off could otherwise never be stopped, and would keep counting time
		const employee = await this.findEmployee();

		// Retrieve tenant ID
		const tenantId = RequestContext.currentTenantId() ?? request.tenantId;
		// Retrieve the employee ID and organization ID
		const { id: employeeId, organizationId } = employee;

		// With no other start or stop of the employee in between, in this process (inEmployeeTurn)
		return await this.inEmployeeTurn(employeeId, (turn) =>
			this.stopRunningLog(request, employeeId, organizationId, tenantId, turn, receivedAt)
		);
	}

	/**
	 * Stops the employee's running log, as `stopTimer` asks, then the runs left going beside it.
	 *
	 * @param request The stop request.
	 * @param employeeId The employee stopping their timer.
	 * @param organizationId The employee's organization.
	 * @param tenantId The employee's tenant.
	 * @param turn The employee's turn this stop holds: once it has passed, the stop writes no time log.
	 * @param receivedAt When the stop arrived, before it waited for its turn: the end of a stop that names none.
	 * @returns The stopped log.
	 * @throws NotAcceptableException when no log of the employee runs.
	 * @throws RequestTimeoutException when the stop took so long that the next start or stop went on.
	 */
	private async stopRunningLog(
		request: ITimerToggleInput,
		employeeId: ID,
		organizationId: ID,
		tenantId: ID,
		turn: EmployeeTurn,
		receivedAt?: Date
	): Promise<ITimeLog> {
		// The runs going as this stop begins, latest first: the latest is the one it stops, any other was left going
		// beside it. The cleanup after the stop handles those only, never a run another client starts meanwhile.
		const includeTimeSlots = true;
		const runningLogs = await this.getLastRunningLogs(includeTimeSlots);
		const runningLogIds = runningLogs.map((log) => log.id);
		let lastLog = runningLogs[0];

		// If no running log is found, throw a NotAcceptableException
		if (!lastLog) {
			this.logger.warn(`No running log found. Can't stop timer because it was already stopped.`);
			throw new NotAcceptableException(`No running log found. Can't stop timer because it was already stopped.`);
		}

		// A stop meant for another run is refused before anything is written, and the running log goes on
		this.assertStopIsForRunningLog(request, lastLog, receivedAt);

		// Calculate stoppedAt date or use current date if not provided
		const stoppedAt = await this.calculateStoppedAt(request, lastLog, receivedAt);
		this.debug(() => `last stopped at: ${stoppedAt}`);

		// Log the case where stoppedAt is less than startedAt
		if (stoppedAt < lastLog.startedAt) {
			this.logger.warn(
				`stoppedAt (${stoppedAt}) is less than startedAt (${lastLog.startedAt}), skipping stoppedAt update.`
			);
		}

		// Construct the update payload, conditionally excluding stoppedAt if it shouldn't be updated
		const partialTimeLog: Partial<ITimeLog> = {
			isRunning: false,
			...(stoppedAt >= lastLog.startedAt && { stoppedAt }) // Only include stoppedAt if it's valid
		};

		this.debug(() => `partial time log: ${JSON.stringify(partialTimeLog)}`);

		// The logs this run overlaps as the stop begins, up to the end written below. The overlap cleanup after the stop
		// cuts those only: a log another client writes meanwhile keeps its time, whether it still runs or not.
		const endToWrite = partialTimeLog.stoppedAt ?? lastLog.stoppedAt;
		const overlappingAtStop = await this.findOverlappingLogIds(
			lastLog,
			endToWrite,
			runningLogIds,
			tenantId,
			organizationId
		);

		// A run still going beside this one started before it, so it ends no later than this one's start (below)
		const stoppedRunStartedAt = lastLog.startedAt;

		// A stop whose reads took so long that the next start or stop went on leaves the run to that one
		turn.assertHeld();

		// Execute the command to update the time log entry
		lastLog = await this._commandBus.execute(
			new TimeLogUpdateCommand(partialTimeLog, lastLog.id, request.manualTimeSlot)
		);

		// Stop the runs left going beside this one, and only those
		await this.stopPreviousRunningTimers(
			employeeId,
			organizationId,
			tenantId,
			stoppedRunStartedAt,
			runningLogIds,
			turn
		);

		// Handle conflicting time logs: the ones this run overlapped as the stop began
		turn.assertHeld();
		const forceDelete = false;
		await this.handleConflictingTimeLogs(lastLog, tenantId, organizationId, forceDelete, overlappingAtStop);

		// The employee no longer tracks time, unless a run is still going: one another client started meanwhile
		await this.markNotTrackingAfterStop(employeeId, organizationId, tenantId);

		// Return the last log
		return lastLog;
	}

	/**
	 * Refuses a stop that is not for the running log, and nothing is written. Such a stop comes from a view still
	 * showing an earlier run, which a start on another device or tab has replaced since, and it used to end the newer
	 * run instead:
	 * - one naming another time log than the running one (`timeLogId`) is refused with 409;
	 * - one asking to stop the running log before it started, as a stop carrying the earlier run's dates does, is
	 *   refused with 406, as a stop with nothing running is, so a client takes it as "already stopped". It used to
	 *   close the newer run at zero duration;
	 * - one naming no time that arrived before the running log started is refused with 406 too: a start that got the
	 *   employee's turn first (`inEmployeeTurn`) stopped the run this stop was for and began a newer one, which the
	 *   stop, ending at the time it arrived, would otherwise close (CodeRabbit on #11931).
	 *
	 * Only the time the client asks for, or the time the stop arrived, is checked: the end a desktop stop gets from its
	 * time slots (`calculateStoppedAt`) may fall before the start, and that stop still closes the log, as before.
	 *
	 * @param request - The stop, as the client sent it.
	 * @param runningLog - The employee's running log, the one the stop would end.
	 * @param receivedAt - When the stop arrived, before it waited for its turn; the stop's end when it names none.
	 * @throws ConflictException when the stop names another time log than the running one.
	 * @throws NotAcceptableException when the stop's end (the requested `stoppedAt`, else the time it arrived) is
	 *   before the running log's `startedAt`.
	 */
	private assertStopIsForRunningLog(request: ITimerToggleInput, runningLog: ITimeLog, receivedAt?: Date): void {
		// Time log ids are UUIDs, whose letters compare in either case
		const namesAnotherLog =
			isTimeLogNamed(request) && String(request.timeLogId).toLowerCase() !== String(runningLog.id).toLowerCase();
		if (namesAnotherLog) {
			this.logger.warn(`Stop refused: it names another time log than the running one, ${runningLog.id}.`);
			throw new ConflictException(
				'This stop names a time log that is not the running one. Nothing was stopped: the running timer goes on.'
			);
		}

		// The stop's end: the time it asks for, else the time it arrived (`calculateStoppedAt`)
		const asksForStopTime = isNotEmpty(request.stoppedAt);
		const stopTime = asksForStopTime ? request.stoppedAt : receivedAt;
		if (!isNotEmpty(stopTime)) {
			return;
		}

		const requestedStoppedAt = moment.utc(stopTime);
		const runningSince = moment.utc(runningLog.startedAt);
		const stopsBeforeStart = requestedStoppedAt.isBefore(runningSince);
		if (stopsBeforeStart) {
			const what = asksForStopTime ? 'Stop at' : 'Stop (naming no time) received at';
			this.logger.warn(
				`${what} ${requestedStoppedAt.toISOString()} refused: the running log ${runningLog.id} started after it, at ${runningSince.toISOString()}.`
			);
			throw new NotAcceptableException(
				'No running log found for this stop: the running timer started after the requested stop time.'
			);
		}
	}

	/**
	 * Handles any conflicting time logs that overlap with the current time log entry.
	 *
	 * @param lastLog The last running time log entry.
	 * @param tenantId The tenant ID.
	 * @param organizationId The organization ID.
	 * @param forceDelete Flag indicating whether to force delete the conflicts.
	 * @param overlappingAtStop The logs the run overlapped as the stop began (`findOverlappingLogIds`), the only ones
	 * cut. A log not among them was written since, by another client (a run it started, or started and stopped), and
	 * keeps its time slots. Every log found when not given.
	 */
	private async handleConflictingTimeLogs(
		lastLog: ITimeLog,
		tenantId: ID,
		organizationId: ID,
		forceDelete: boolean = false,
		overlappingAtStop?: ID[]
	): Promise<void> {
		// Nothing overlapped the run as the stop began, so no log is the cleanup's to cut
		const hadNoOverlap = overlappingAtStop?.length === 0;
		if (hadNoOverlap) {
			return;
		}
		try {
			// Validate the date range and check if the timer is running
			validateDateRange(lastLog.startedAt, lastLog.stoppedAt);

			// Retrieve conflicting time logs
			const conflicts = await this._commandBus.execute(
				new IGetConflictTimeLogCommand({
					ignoreId: lastLog.id,
					startDate: lastLog.startedAt,
					endDate: lastLog.stoppedAt,
					employeeId: lastLog.employeeId,
					organizationId: organizationId || lastLog.organizationId,
					tenantId
				})
			);

			this.debug(
				() =>
					`Conflicting Time Logs: ${JSON.stringify({
						conflicts,
						ignoreId: lastLog.id,
						startDate: lastLog.startedAt,
						endDate: lastLog.stoppedAt,
						employeeId: lastLog.employeeId,
						organizationId: organizationId || lastLog.organizationId,
						tenantId
					})}`
			);

			// Resolve conflicts by deleting conflicting time slots
			if (conflicts?.length) {
				const times: IDateRange = {
					start: new Date(lastLog.startedAt),
					end: new Date(lastLog.stoppedAt)
				};

				// Loop through each conflicting time log
				for await (const timeLog of conflicts) {
					// A log another client wrote since the stop began is left alone, still running or not
					const isWrittenSinceStop =
						overlappingAtStop !== undefined && !overlappingAtStop.includes(timeLog.id);
					if (isWrittenSinceStop) {
						continue;
					}
					const { timeSlots = [] } = timeLog;
					// Delete conflicting time slots
					for await (const timeSlot of timeSlots) {
						await this._commandBus.execute(
							new DeleteTimeSpanCommand(times, timeLog, timeSlot, forceDelete)
						);
					}
				}
			}
		} catch (error) {
			this.logger.warn(`Error while handling conflicts in time logs: ${error?.message}`);
		}
	}

	/**
	 * The ids of the employee's other logs the run overlaps up to `stoppedAt`, read as the overlap cleanup reads them
	 * after the stop (`IGetConflictTimeLogCommand`, same range and scope). Read before the stop's update, they are the
	 * logs that cleanup may cut. When they cannot be read, none: the cleanup is skipped rather than cut a log it cannot
	 * tell from one written meanwhile.
	 *
	 * This read comes after the stop's read of the runs going (`runningAtStop`). A log running here that was not going
	 * then was started in between, by another client: it is left out, as the runs started later are.
	 *
	 * @param run The running log the stop ends, as read when the stop began.
	 * @param stoppedAt Where the stop ends it.
	 * @param runningAtStop The runs going at the stop's first read.
	 * @param tenantId The employee's tenant.
	 * @param organizationId The employee's organization.
	 * @returns The ids of the logs it overlaps.
	 */
	private async findOverlappingLogIds(
		run: ITimeLog,
		stoppedAt: Date,
		runningAtStop: ID[],
		tenantId: ID,
		organizationId: ID
	): Promise<ID[]> {
		try {
			validateDateRange(run.startedAt, stoppedAt);
			const overlapping: ITimeLog[] = await this._commandBus.execute(
				new IGetConflictTimeLogCommand({
					ignoreId: run.id,
					startDate: run.startedAt,
					endDate: stoppedAt,
					employeeId: run.employeeId,
					organizationId: organizationId || run.organizationId,
					tenantId
				})
			);
			const isFinishedOrRunningAtStop = (log: ITimeLog) => !log.isRunning || runningAtStop.includes(log.id);
			return (overlapping ?? []).filter(isFinishedOrRunningAtStop).map((log) => log.id);
		} catch (error) {
			this.logger.warn(
				`The overlap cleanup of time log ${run.id} is skipped, the logs it overlaps could not be read: ${error?.message}`
			);
			return [];
		}
	}

	/**
	 * Calculates the stoppedAt time for the current time log based on the request and the last running time log.
	 * It adjusts the stoppedAt time based on various conditions, such as the time log source (e.g., DESKTOP) and time slots.
	 *
	 * - If the source is DESKTOP, the last log is a tracker's (`isTrackerSource`) and the last time slot was created
	 *   more than 10 minutes ago, the stoppedAt time is adjusted based on the last time slot's duration.
	 * - If no time slots exist and the last log's startedAt time exceeds 10 minutes from the current time,
	 *   the stoppedAt time is adjusted by 10 seconds from the startedAt time.
	 *
	 * The desktop also stops, with its own source, the runs it shows from other clients. Those send no time slots of
	 * a tracker to go by, so such a run ends at the time the stop asks for, as with any other client's stop.
	 *
	 * @param {ITimerToggleInput} request - The input data for stopping the timer, including stoppedAt and source.
	 * @param {ITimeLog} lastLog - The last running time log, which may include time slots for more detailed tracking.
	 * @returns {Promise<Date>} - A promise that resolves to the calculated stoppedAt date, adjusted as necessary.
	 */
	async calculateStoppedAt(request: ITimerToggleInput, lastLog: ITimeLog, receivedAt?: Date): Promise<Date> {
		// Retrieve stoppedAt date or default to when the stop was received (not when its turn came: a stop queued behind
		// another start or stop of the employee must not count the wait as worked time), else the current date
		let stoppedAt = moment.utc(request.stoppedAt ?? receivedAt ?? moment.utc()).toDate();

		// Handle the DESKTOP source case, for a tracker's run only: not a run the desktop shows from another client
		const isDesktopStopOfTrackerRun =
			request.source === TimeLogSourceEnum.DESKTOP && isTrackerSource(lastLog.source);
		if (isDesktopStopOfTrackerRun) {
			// Retrieve the most recent time slot from the last log
			const lastTimeSlot: ITimeSlot | undefined = lastLog.timeSlots?.sort((a: ITimeSlot, b: ITimeSlot) =>
				moment(b.startedAt).diff(a.startedAt)
			)[0];
			// Example:
			// If lastLog.timeSlots = [{ startedAt: "2024-09-24 19:50:00", duration: 600 }, { startedAt: "2024-09-24 19:40:00", duration: 600 }]
			// The sorted result will be [{ startedAt: "2024-09-24 19:50:00", duration: 600 }, { startedAt: "2024-09-24 19:40:00", duration: 600 }]
			// Hence, lastTimeSlot will be the one with startedAt = "2024-09-24 19:50:00".

			// Check if the last time slot was created more than 10 minutes ago
			if (lastTimeSlot) {
				// Retrieve the last time slot's startedAt date
				const lastTimeSlotStartedAt = moment.utc(lastTimeSlot.startedAt);

				// Retrieve the request stopped moment
				const requestStoppedAt = moment.utc(stoppedAt);

				// Retrieve the last time slot's duration
				const duration = lastTimeSlot.duration;

				// Example:
				// If lastTimeSlotStartedAt = "2024-09-24 19:50:00" and duration = 600 (10 minutes)
				// and the current time is "2024-09-24 20:10:00", the difference is 20 minutes, which is more than 10 minutes.

				// Check if the last time slot was created more than 10 minutes ago
				if (requestStoppedAt.diff(lastTimeSlotStartedAt, 'minutes') > 10) {
					// Calculate the potential stoppedAt time using the total duration
					stoppedAt = lastTimeSlotStartedAt.add(duration, 'seconds').toDate();
					// Example: stoppedAt = "2024-09-24 20:00:00"
				}
			} else {
				// Retrieve the last log's startedAt date
				const lastLogStartedAt = moment.utc(lastLog.startedAt);

				// Example:
				// If lastLog.startedAt = "2024-09-24 19:30:00" and there are no time slots,
				// and the current time is "2024-09-24 20:00:00", the difference is 30 minutes.

				// If no time slots exist and the difference is more than 10 minutes, adjust the stoppedAt
				if (moment.utc().diff(lastLogStartedAt, 'minutes') > 10) {
					stoppedAt = moment.utc(lastLog.startedAt).add(10, 'seconds').toDate();
					// Example: stoppedAt will be "2024-09-24 19:30:10"
				}
			}
		}

		this.debug(() => `Last calculated stoppedAt: ${stoppedAt}`);
		// Example log output: "Last calculated stoppedAt: 2024-09-24 20:00:00"
		return stoppedAt;
	}

	/**
	 * Calculates the stoppedAt time based on the last log and request parameters.
	 * It handles the case for DESKTOP source, considering time slots' durations.
	 *
	 * @param request - The input request containing timer toggle information
	 * @param lastLog - The last running time log for the employee
	 * @returns The calculated stoppedAt date
	 */
	async calculateStoppedAt2(request: ITimerToggleInput, lastLog: ITimeLog): Promise<Date> {
		// Retrieve stoppedAt date or default to the current date if not provided
		let stoppedAt = moment.utc(request.stoppedAt ?? moment.utc()).toDate();
		this.debug(() => `last stop request was at ${stoppedAt}`);

		// Handle the DESKTOP source case
		if (request.source === TimeLogSourceEnum.DESKTOP) {
			// Retrieve the most recent time slot from the last log
			const lastTimeSlot: ITimeSlot | undefined = lastLog.timeSlots?.sort((a: ITimeSlot, b: ITimeSlot) =>
				moment(b.startedAt).diff(a.startedAt)
			)[0];

			// Example:
			// If lastLog.timeSlots = [{ startedAt: "2024-09-24 19:50:00", duration: 600 }, { startedAt: "2024-09-24 19:40:00", duration: 600 }]
			// The sorted result will be [{ startedAt: "2024-09-24 19:50:00", duration: 600 }, { startedAt: "2024-09-24 19:40:00", duration: 600 }]
			// Hence, lastTimeSlot will be the one with startedAt = "2024-09-24 19:50:00".

			// Check if the last time slot was created more than 10 minutes ago
			if (lastTimeSlot) {
				const duration = lastTimeSlot.duration; // Retrieve the last time slot's duration
				const startedAt = moment.utc(lastTimeSlot.startedAt); // Retrieve the last time slot's startedAt date

				// Example:
				// If lastTimeSlotStartedAt = "2024-09-24 19:50:00" and duration = 600 (10 minutes)
				// and the current time is "2024-09-24 20:10:00", the difference is 20 minutes, which is more than 10 minutes.

				const difference = moment.utc(stoppedAt).diff(startedAt, 'minutes');
				this.debug(() => `Last time slot (${duration}) created ${difference} mins ago at ${startedAt}`);

				// Check if the last time slot was created more than 10 minutes ago
				if (difference > 10) {
					stoppedAt = startedAt.add(duration, 'seconds').toDate(); // Calculate the potential stoppedAt time using the total duration
					// Example: stoppedAt = "2024-09-24 20:00:00"
				}
			} else {
				// Retrieve the last log's startedAt date
				const startedAt = moment.utc(lastLog.startedAt);
				// Example:
				// If lastLog.startedAt = "2024-09-24 19:30:00" and there are no time slots,
				// and the current time is "2024-09-24 20:00:00", the difference is 30 minutes.

				const difference = moment.utc(stoppedAt).diff(startedAt, 'minutes');
				this.debug(() => `last log was created more than ${difference} minutes ago at ${startedAt}`);

				// If no time slots exist and the difference is more than 10 minutes, adjust the stoppedAt
				if (difference > 10) {
					stoppedAt = startedAt.add(10, 'seconds').toDate();
					// Example: stoppedAt will be "2024-09-24 19:30:10"
				}
			}
		}

		this.debug(() => `Final last calculated stoppedAt: ${stoppedAt}`);
		// Example log output: "Last calculated stoppedAt: 2024-09-24 20:00:00"
		return stoppedAt;
	}

	/**
	 * Discards the caller's running timer: the run is removed with its time slots, screenshots and activity, through
	 * the time log delete, as if it never started. The time was never kept, so no permission to delete time is asked.
	 * The organization may turn discarding off (`allowDiscardTimer`) or allow it only for recent runs
	 * (`discardTimerWithinMinutes`). Only the caller's running log is removed, never a stopped entry.
	 *
	 * @param request The discard, with the running time log it is for when the client names one.
	 * @throws ForbiddenException with the code TIMER_DISCARD_DISABLED or TIMER_DISCARD_TOO_LATE.
	 * @throws BadRequestException when no timer runs.
	 * @throws ConflictException when the discard names another time log than the running one: nothing is removed.
	 */
	async discardTimer(request: ITimerDiscardInput): Promise<void> {
		const employee = await this.findEmployee({ organization: true });

		const disabledRefusal = discardDisabledRefusal(employee.organization);
		if (disabledRefusal) {
			throw new ForbiddenException(disabledRefusal);
		}

		const includeTimeSlots = true;
		const runningLog = await this.getLastRunningLog(includeTimeSlots);
		if (!runningLog) {
			throw new BadRequestException('No timer is running: there is nothing to discard.');
		}

		this.assertDiscardIsForRunningLog(request, runningLog);

		const tooLateRefusal = discardTooLateRefusal(
			employee.organization,
			runningLog.startedAt,
			moment.utc().toDate()
		);
		if (tooLateRefusal) {
			throw new ForbiddenException(tooLateRefusal);
		}

		// A stop from another tab or device may have landed since the read: it kept the entry, which is never removed
		const isClaimed = await this.claimRunningLog(runningLog.id);
		if (!isClaimed) {
			throw new BadRequestException('No timer is running: there is nothing to discard.');
		}

		const tenantId = RequestContext.currentTenantId() ?? request.tenantId;
		const { id: employeeId, organizationId } = employee;

		const forceDelete = true;
		try {
			await this._commandBus.execute(new TimeLogDeleteCommand(runningLog as TimeLog, forceDelete));
		} catch (error) {
			await this.releaseRunningLog(runningLog.id, employeeId, organizationId, tenantId);
			throw error;
		}

		// A run another device started meanwhile is left running, and keeps the employee tracking
		await this.markNotTrackingWhenNothingRuns(employeeId, organizationId, tenantId);
	}

	/**
	 * Takes the run for a discard: marks it as no longer running, in one statement that only changes it while it still
	 * runs. A stop that landed first leaves nothing to take.
	 *
	 * @returns Whether the run still ran and is now the discard's to remove.
	 */
	private async claimRunningLog(timeLogId: ID): Promise<boolean> {
		const stillRunning = { id: timeLogId, isRunning: true };
		const taken = { isRunning: false };
		switch (this.ormType) {
			case MultiORMEnum.MikroORM: {
				const changedRows = await this.mikroOrmTimeLogRepository.nativeUpdate(stillRunning, taken);
				return changedRows > 0;
			}
			case MultiORMEnum.TypeORM:
			default: {
				const { affected } = await this.typeOrmTimeLogRepository.update(stillRunning, taken);
				// Every driver of the platform reports the count; one that would not is read as a change
				const isCountUnknown = typeof affected !== 'number';
				return isCountUnknown || affected > 0;
			}
		}
	}

	/**
	 * Gives a run taken for a discard its running state back, when removing it failed. Not when another run of the
	 * employee started meanwhile: the failed run then stays stopped, so that two timers never run.
	 */
	private async releaseRunningLog(timeLogId: ID, employeeId: ID, organizationId: ID, tenantId: ID): Promise<void> {
		const taken = { id: timeLogId, isRunning: false };
		const running = { isRunning: true };
		try {
			const otherRuns = await this.findTimeLogsWhere({ employeeId, organizationId, tenantId, isRunning: true });
			const hasAnotherRun = otherRuns.length > 0;
			if (hasAnotherRun) {
				this.logger.warn(`Time log ${timeLogId} stays stopped: another run of the employee started meanwhile.`);
				return;
			}

			switch (this.ormType) {
				case MultiORMEnum.MikroORM:
					await this.mikroOrmTimeLogRepository.nativeUpdate(taken, running);
					return;
				case MultiORMEnum.TypeORM:
				default:
					await this.typeOrmTimeLogRepository.update(taken, running);
			}
		} catch (error) {
			this.logger.warn(`Failed to give the running state back to time log ${timeLogId}: ${error?.message}`);
		}
	}

	/**
	 * Refuses a discard naming another time log than the running one, as a stop naming one is: it comes from a view
	 * still showing an earlier run, and would otherwise remove the newer run a start on another device or tab began.
	 *
	 * @throws ConflictException when the discard names another time log than the running one.
	 */
	private assertDiscardIsForRunningLog(request: ITimerDiscardInput, runningLog: ITimeLog): void {
		if (!isTimeLogNamed(request)) {
			return;
		}
		// Time log ids are UUIDs, whose letters compare in either case
		const namesRunningLog = String(request.timeLogId).toLowerCase() === String(runningLog.id).toLowerCase();
		if (namesRunningLog) {
			return;
		}
		this.logger.warn(`Discard refused: it names another time log than the running one, ${runningLog.id}.`);
		throw new ConflictException(
			'This discard names a time log that is not the running one. Nothing was discarded: the running timer goes on.'
		);
	}

	/**
	 * Toggle time tracking start/stop
	 *
	 * @param request The timer toggle request input
	 * @returns The started or stopped TimeLog
	 */
	async toggleTimeLog(request: ITimerToggleInput): Promise<TimeLog> {
		// Retrieve the last running time log
		const lastLog = await this.getLastRunningLog();

		// A toggle naming a time log is a stop of that log: it never starts a timer in its place, and with nothing
		// running it is refused as that stop is
		const namesTimeLog = isTimeLogNamed(request);

		// Start a new timer if no running log exists, otherwise stop the current timer
		if (!lastLog && !namesTimeLog) {
			return this.startTimer(request);
		} else {
			return this.stopTimer(request);
		}
	}

	/** The start or stop queued last in this process, by employee: the next one waits for it (`inEmployeeTurn`). */
	private static readonly employeeTurns = new Map<ID, QueuedTurn>();

	/**
	 * Runs `work`, a start or a stop of the employee's timer, once the start or stop of theirs before it in this
	 * process has settled. Interleaved, a start read the run a stop was closing as still going and closed it a second
	 * time, and two starts at once both found nothing going and both created a run.
	 *
	 * The API processes do not share this order: a start and a stop reaching two of them at once still interleave,
	 * and the stop's cleanup then leaves the started run going (`stopRunningLog`).
	 *
	 * A start or a stop keeps the turn `EMPLOYEE_TURN_FAILSAFE_MS` at most from when it began: one that never settles
	 * (a database that never answers) does not hold the employee's timer in this process for good. The next one may then
	 * go on, and once it does, the one that hung writes no time log any more (`EmployeeTurn`, checked before each of its
	 * writes): it creates no second run and ends none of the next one's. A run it was already creating is closed again
	 * (`closeRunCreatedLate`), and its cleanup ends only the runs it read (`stopPreviousRunningTimers`). Another write
	 * it had already sent can still land, which only a lock in the database would stop.
	 *
	 * @param employeeId - The employee whose timer starts or stops.
	 * @param work - The start or the stop, given the turn it holds.
	 * @returns What `work` returns.
	 */
	private async inEmployeeTurn<T>(employeeId: ID, work: (turn: EmployeeTurn) => Promise<T>): Promise<T> {
		const previous = TimerService.employeeTurns.get(employeeId);
		let isHeld = true;
		let isSettled = false;
		const turn: EmployeeTurn = {
			isHeld: () => isHeld,
			assertHeld: () => {
				if (!isHeld) {
					throw new RequestTimeoutException(
						'Your timer took too long to answer, and a later start or stop went ahead. Check your timer.'
					);
				}
			}
		};
		// Once the one before has settled, or has run for the failsafe time: still running, it then loses the turn
		const begin = (previous?.end ?? Promise.resolve()).then(() => previous?.passOn());
		const run = begin.then(() => work(turn));
		const markSettled = () => {
			isSettled = true;
		};
		run.then(markSettled, markSettled);
		const queued: QueuedTurn = {
			// The clock starts with this one, so those after it still go one at a time
			end: begin.then(() => TimerService.settledOrFailsafe(run)),
			passOn: () => {
				if (isSettled || !isHeld) {
					return;
				}
				isHeld = false;
				this.logger.warn(
					`A start or stop of employee ${employeeId} has run for over ${EMPLOYEE_TURN_FAILSAFE_MS} ms and the next one goes on: this one writes no time log any more.`
				);
			}
		};
		TimerService.employeeTurns.set(employeeId, queued);
		try {
			return await run;
		} finally {
			if (TimerService.employeeTurns.get(employeeId) === queued) {
				TimerService.employeeTurns.delete(employeeId);
			}
		}
	}

	/**
	 * Settles when `run` does, or once `EMPLOYEE_TURN_FAILSAFE_MS` have passed, whichever comes first, and never
	 * rejects.
	 *
	 * @param run - The start or the stop, which has just begun.
	 */
	private static settledOrFailsafe(run: Promise<unknown>): Promise<void> {
		let failsafe: ReturnType<typeof setTimeout> | undefined;
		const timedOut = new Promise<void>((resolve) => {
			failsafe = setTimeout(resolve, EMPLOYEE_TURN_FAILSAFE_MS);
			// The wait alone never keeps the process alive
			failsafe.unref?.();
		});
		const settled = run.then(
			() => undefined,
			() => undefined
		);
		return Promise.race([settled, timedOut]).finally(() => clearTimeout(failsafe));
	}

	/**
	 * Closes a run its start created after the next start or stop of the employee went on (`inEmployeeTurn`). That one
	 * may have read the runs going before this run was written, and then neither ended it nor counted it: left running,
	 * it would be a second timer beside the next one's. It ends where it started, as a start that did not happen,
	 * unless the next one already ended it. If that fails, the employee's next start or stop ends it.
	 *
	 * @param timeLog - The run the start created.
	 * @param tenantId - The employee's tenant.
	 */
	private async closeRunCreatedLate(timeLog: ITimeLog, tenantId: ID): Promise<void> {
		const isEndedAlready = Boolean(await this.storedStoppedLog(timeLog.id, tenantId));
		if (isEndedAlready) {
			return;
		}
		const startedAt = moment.utc(timeLog.startedAt).toDate();
		try {
			await this._commandBus.execute(
				new TimeLogUpdateCommand({ isRunning: false, startedAt, stoppedAt: startedAt }, timeLog.id)
			);
		} catch (error) {
			this.logger.warn(
				`Failed to close the time log ${timeLog.id}, created after the next start or stop went on; the employee's next start or stop ends it: ${error?.message}`
			);
		}
	}

	/**
	 * Stops all previous running timers for the specified employee: the runs still going when another run replaces
	 * them (a timer that starts, or the run a stop just ended).
	 *
	 * A run from a client that is not a tracker ends through the update an explicit stop makes, so it gets its time
	 * slots and counts in the worked time, where `replacedRunEnd` says: at its last heartbeat (an Ever Teams or mobile
	 * run's start counting as its first), or, for a client that sends none, where the run after it started. A
	 * tracker's run (`isTrackerSource`: the desktop timer and the agent) keeps the end its time slots give it
	 * (`ScheduleTimeLogEntriesCommand`), as does a run stored without a `stoppedAt`, which has no heartbeat to go by;
	 * that command also stops a run whose stop here failed, as before.
	 *
	 * After a stop, only the runs that were going when the stop began are stopped (`onlyAmong`): a run another client
	 * started while the stop ran is its replacement, not a run left going, and keeps going. The command is given the
	 * runs read here, after a start too, so a run written after that read is never its to end.
	 *
	 * @param employeeId - The ID of the employee whose timers need to be stopped
	 * @param organizationId - The ID of the organization to which the employee belongs
	 * @param tenantId - The ID of the tenant context
	 * @param replacedAt - When the run replacing them started; now by default
	 * @param onlyAmong - When given, only the runs among these ids are stopped; all of them by default
	 * @param turn - The employee's turn of the start or stop calling: once it has passed, nothing more is stopped
	 */
	async stopPreviousRunningTimers(
		employeeId: ID,
		organizationId: ID,
		tenantId: ID,
		replacedAt: Date = moment.utc().toDate(),
		onlyAmong?: ID[],
		turn?: EmployeeTurn
	): Promise<void> {
		try {
			this.debug(() => 'Start previous running timers...');
			// Retrieve any existing running logs for the employee, latest first, with their time slots
			const includeTimeSlots = true;
			const runningLogs = await this.getLastRunningLogs(includeTimeSlots);
			const logs = onlyAmong ? runningLogs.filter((log) => onlyAmong.includes(log.id)) : runningLogs;
			this.debug(() => `Last Running Logs Count: ${logs.length}`);

			// The replacing run is the run after the latest, the latest the run after the one before it, and so on
			let nextRunStartedAt = moment.utc(replacedAt);
			for (const log of logs) {
				const isStoppedHere = !isTrackerSource(log.source) && Boolean(log.stoppedAt);
				if (isStoppedHere) {
					turn?.assertHeld();
					await this.stopReplacedRun(log, this.replacedRunEnd(log, nextRunStartedAt), turn);
				}
				nextRunStartedAt = moment.min(moment.utc(log.startedAt), nextRunStartedAt);
			}

			// If there are existing running logs, stop them before starting a new one
			if (logs.length > 0) {
				// Once the turn has passed, the command would also end the run the next start created
				turn?.assertHeld();
				// The command stops the runs read here, and only those: a run written since, by another client or by the
				// next start once this one has outlived the failsafe time, is never its to end, however late it reads
				const readRunIds = logs.map((log) => log.id);
				await this._commandBus.execute(
					new ScheduleTimeLogEntriesCommand(employeeId, organizationId, tenantId, readRunIds)
				);
			}
			this.debug(() => 'Stop previous running timers...');
		} catch (error) {
			// Log the error or handle it appropriately
			this.logger.warn(`Failed to stop previous running timers: ${error?.message}`);
		}
	}

	/**
	 * Where a run from a client that is not a tracker ends when the run after it started at `nextRunStartedAt`.
	 *
	 * One that has had heartbeats (its `stoppedAt` moved past its start, as the time slots its client posts move it,
	 * or time slots of its own) ends at its last heartbeat: the later of its `stoppedAt` and the end of its last time
	 * slot, so it never gets less than its time slots hold. So does a run of a client that posts a time slot on each
	 * heartbeat (`postsHeartbeatSlots`: Ever Teams, mobile), its start counting as the first: one without any died in
	 * its first minute, and ends at its start, as Ever Teams' own stale-timer guard ends it. A run left in a tab closed
	 * without a stop is not credited with every hour up to the next start. A run of a client that sends no heartbeat
	 * (the web timer, the API clients) ends at `nextRunStartedAt`, as an explicit stop then would. Never after
	 * `nextRunStartedAt`, so no time counts twice, and never before its own start.
	 *
	 * @param log - The running log, with its time slots.
	 * @param nextRunStartedAt - When the run after it started.
	 * @returns Where it ends.
	 */
	private replacedRunEnd(log: ITimeLog, nextRunStartedAt: moment.Moment): Date {
		const startedAt = moment.utc(log.startedAt);
		const timeSlotEnds = (log.timeSlots ?? []).map((slot) =>
			moment.utc(slot.startedAt).add(slot.duration, 'seconds')
		);
		const lastHeartbeat = moment.max(moment.utc(log.stoppedAt), ...timeSlotEnds);
		const hasHadHeartbeat = lastHeartbeat.isAfter(startedAt) || timeSlotEnds.length > 0;
		// A client that posts heartbeats counts the start as the first one: a run of theirs without any ends there
		const endsAtLastHeartbeat = hasHadHeartbeat || postsHeartbeatSlots(log.source);
		const end = endsAtLastHeartbeat ? moment.min(lastHeartbeat, nextRunStartedAt) : nextRunStartedAt;
		return moment.max(startedAt, end).toDate();
	}

	/**
	 * Stops a run replaced by another at the given time, as an explicit stop at that time would.
	 *
	 * When the update fails, the log is read back. The update writes the stop before its later steps, so a log that no
	 * longer runs was stopped and a later step failed. Those steps run again safely from what was written: the web
	 * timer's time slots are created only where missing and linked to the stopped range, the timesheet and worked hours
	 * are recomputed. So the update is sent once more to complete them, given the log as it was before the first try:
	 * the update plans the release of the slots past an end it moves back from the range it is given, and the stored
	 * range is already the new one. If the second try fails too, the log keeps its stop, as
	 * `ScheduleTimeLogEntriesCommand` only stops logs still running, and the warning says what may be missing. A log
	 * still running had nothing written, so it gets the same update once more: left running, that command would end a
	 * run without time slots ten seconds after its start. If the second try fails too, the log is left to that command,
	 * which stops it as before. The new run starts either way.
	 *
	 * @param log - The running log.
	 * @param stoppedAt - Where it ends.
	 * @param turn - The employee's turn of the start or stop calling: once it has passed, there is no second try.
	 */
	private async stopReplacedRun(log: ITimeLog, stoppedAt: Date, turn?: EmployeeTurn): Promise<void> {
		// With its own start too: an update naming none files the log under the current week's timesheet
		const startedAt = moment.utc(log.startedAt).toDate();
		const partialTimeLog: Partial<ITimeLog> = { isRunning: false, startedAt, stoppedAt };
		try {
			await this._commandBus.execute(new TimeLogUpdateCommand(partialTimeLog, log.id));
		} catch (error) {
			const storedLog = await this.storedStoppedLog(log.id, log.tenantId);
			// Past the failsafe time the next start or stop has gone on, and the run is its to end: no second try
			turn?.assertHeld();
			if (!storedLog) {
				// Nothing was written: the same update once more, so the run ends where it should
				try {
					await this._commandBus.execute(new TimeLogUpdateCommand(partialTimeLog, log.id));
					this.logger.warn(`Stopped the replaced time log ${log.id} on a second try: ${error?.message}`);
				} catch (retryError) {
					this.logger.warn(
						`Failed to stop the replaced time log ${log.id} on a second try, left to the cleanup if it still runs: ${retryError?.message}`
					);
				}
				return;
			}
			try {
				// The log as read before the first try, with the range the update releases slots from
				const logBeforeStop = new TimeLog({ ...log, timeSlots: undefined });
				await this._commandBus.execute(new TimeLogUpdateCommand(partialTimeLog, logBeforeStop));
				this.logger.warn(
					`Completed the stop of the replaced time log ${log.id} on a second try: ${error?.message}`
				);
			} catch (retryError) {
				this.logger.warn(
					`Stopped the replaced time log ${log.id}, but its time slots or totals may be incomplete: ${retryError?.message}`
				);
			}
		}
	}

	/**
	 * Retrieves the current employee record based on the user and tenant context.
	 *
	 * @param relations The relations to load with the employee, none by default.
	 * @returns The employee record if found.
	 * @throws NotFoundException if the employee record is not found.
	 */
	async findEmployee(relations?: FindOptionsRelations<Employee>): Promise<IEmployee> {
		const userId = RequestContext.currentUserId(); // Get the current user ID
		const tenantId = RequestContext.currentTenantId(); // Get the current tenant ID

		// Fetch the employee record using userId and tenantId
		const options: FindOneOptions<Employee> = { where: { tenantId } };
		if (relations) {
			options.relations = relations;
		}
		const employee = await this._employeeService.findOneByUserId(userId, undefined, options);

		if (!employee) {
			throw new NotFoundException('Employee record not found. Please verify your details and try again.');
		}

		return employee;
	}

	/**
	 * Get the last running log or all pending running logs for the current employee
	 *
	 * @param fetchAll - Set to `true` to fetch all pending logs, otherwise fetch the last running log
	 * @param includeTimeSlots - Set to `true` to include the associated time slots in the result
	 * @returns A single time log if `fetchAll` is `false`, or an array of time logs if `fetchAll` is `true`
	 */
	private async getRunningLogs(
		fetchAll: boolean = false,
		includeTimeSlots: boolean = false
	): Promise<ITimeLog | ITimeLog[]> {
		const tenantId = RequestContext.currentTenantId(); // Retrieve the tenant ID from the current context

		// Extract employeeId and organizationId
		const { id: employeeId, organizationId } = await this.findEmployee();

		// Define common query conditions. Nothing on `stoppedAt`, as the status read has nothing on it
		// (`buildRunningLogQueryParameters`): a running log is written with `stoppedAt = startedAt`, but a row stored
		// before `TimeLogCreateHandler` gave it that shape may hold a null `stoppedAt`. Filtering those out left the
		// row running with nothing able to stop it; found here, stop closes it and `stopPreviousRunningTimers` hands
		// it to `ScheduleTimeLogEntriesCommand`, which gives a null `stoppedAt` an end as it stops the log.
		const whereClause = {
			employeeId,
			tenantId,
			organizationId,
			isRunning: true
		};

		switch (this.ormType) {
			case MultiORMEnum.MikroORM: {
				const findOptions = parseTypeORMFindToMikroOrm<TimeLog>({
					where: whereClause,
					order: { startedAt: 'DESC', createdAt: 'DESC' } as any,
					...(includeTimeSlots ? { relations: { timeSlots: true } } : {})
				});

				if (fetchAll) {
					// `findAll` reads its options flat: the order and the time slots go beside `where`
					const items = await this.mikroOrmTimeLogRepository.findAll({
						where: findOptions.where,
						...findOptions.mikroOptions
					});
					return items.map((entity: TimeLog) => wrapSerialize(entity)) as TimeLog[];
				} else {
					const item = await this.mikroOrmTimeLogRepository.findOne(
						findOptions.where,
						findOptions.mikroOptions
					);
					return item ? (wrapSerialize(item) as TimeLog) : null;
				}
			}
			case MultiORMEnum.TypeORM:
			default:
				// Determine whether to fetch a single log or multiple logs
				return fetchAll
					? await this.typeOrmTimeLogRepository.find({
							where: whereClause,
							order: { startedAt: 'DESC', createdAt: 'DESC' },
							...(includeTimeSlots && { relations: { timeSlots: true } })
						})
					: await this.typeOrmTimeLogRepository.findOne({
							where: whereClause,
							order: { startedAt: 'DESC', createdAt: 'DESC' },
							// Determine relations if includeTimeSlots is true
							...(includeTimeSlots && { relations: { timeSlots: true } })
						});
		}
	}

	/**
	 * Get the employee's last running timer log
	 *
	 * @returns The last running ITimeLog entry for the current employee
	 */
	private async getLastRunningLog(includeTimeSlots: boolean = false): Promise<ITimeLog> {
		// Retrieve the last running log by using the `getRunningLogs` method with `fetchAll` set to false
		const lastRunningLog = await this.getRunningLogs(false, includeTimeSlots);

		// Ensure that the returned log is of type ITimeLog
		return lastRunningLog as ITimeLog;
	}

	/**
	 * Get all pending running logs for the current employee
	 *
	 * @param includeTimeSlots - Set to `true` to include the associated time slots in the result
	 * @returns An array of pending time logs
	 */
	private async getLastRunningLogs(includeTimeSlots: boolean = false): Promise<ITimeLog[]> {
		// Retrieve the last running log by using the `getRunningLogs` method with `fetchAll` set to false
		const logs = await this.getRunningLogs(true, includeTimeSlots);

		// Ensure that the returned logs are of type ITimeLog[]
		return logs as ITimeLog[];
	}

	/**
	 * Get timer worked status: each employee's running log, or their latest log when none runs.
	 *
	 * @param request The input parameters for the query.
	 * @returns The timer status for the employee.
	 */
	public async getTimerWorkedStatus(request: ITimerStatusInput): Promise<ITimerStatus[]> {
		// Builds its own query, so the check in the CRUD read methods never runs: assert the
		// sensitive-relation table on the client-supplied relations before anything is loaded.
		assertSensitiveRelationsAllowed(this.typeOrmTimeLogRepository.metadata, request.relations);

		// ORG_MEMBER_LAST_LOG_VIEW, which the default EMPLOYEE role holds, lets a caller name a teammate
		// here — that is the point of the team presence view. The last log itself is the feature; the
		// tracked data hanging off it is not, and the root row is someone else's, so the per-employee
		// restriction never applies to those rows. Drop them unless the caller may act for other employees.
		request = { ...request, relations: withoutTrackedDataRelations(request.relations) };

		const tenantId = RequestContext.currentTenantId() ?? request.tenantId;
		const { organizationId, organizationTeamId, source } = request;

		// Define the array to store employeeIds
		let employeeIds: ID[] = [];

		const permissions = [PermissionsEnum.CHANGE_SELECTED_EMPLOYEE, PermissionsEnum.ORG_MEMBER_LAST_LOG_VIEW];

		// Check if the current user has any of the specified permissions
		if (RequestContext.hasAnyPermission(permissions)) {
			// Set employeeIds based on request.employeeIds or request.employeeId
			employeeIds = (request.employeeIds ?? [request.employeeId]).filter(Boolean);
		} else {
			// EMPLOYEE have the ability to see only their own timer status
			employeeIds = [RequestContext.currentEmployeeId()];
		}

		let lastLogs: TimeLog[] = [];

		switch (this.ormType) {
			case MultiORMEnum.MikroORM:
				const knex = this.mikroOrmTimeLogRepository.getKnex();

				// Construct your SQL query using knex
				let sqlQuery = knex('time_log').select(knex.raw('DISTINCT ON ("time_log"."employeeId") *'));

				// Builds an SQL query with specific where clauses.
				sqlQuery.whereNotNull('startedAt');
				sqlQuery.whereNotNull('stoppedAt');
				// Raw knex skips MikroORM's soft-delete filter: a deleted log must not be picked as the last one
				sqlQuery.whereNull('deletedAt');
				sqlQuery.whereIn('employeeId', employeeIds);
				sqlQuery.andWhere({
					tenantId,
					organizationId,
					isActive: true,
					isArchived: false
				});

				if (source) {
					sqlQuery = sqlQuery.andWhere({ source });
				}
				if (organizationTeamId) {
					sqlQuery = sqlQuery.andWhere({ organizationTeamId });
				}

				// Adds ordering to the SQL query. The running log comes first: it is the employee's last log even beside
				// a log that starts later (manual time, a desktop offline upload). A row without the flag counts as not
				// running, where a bare `"isRunning" DESC` would put its NULL first. Then the latest started.
				sqlQuery = sqlQuery.orderBy([
					{ column: 'employeeId', order: 'ASC' },
					{ column: knex.raw('COALESCE("time_log"."isRunning", false)'), order: 'DESC' },
					{ column: 'startedAt', order: 'DESC' },
					{ column: 'createdAt', order: 'DESC' }
				]);

				// Execute the raw SQL query and get the results
				const rawResults: TimeLog[] = (await knex.raw(sqlQuery.toString())).rows || [];
				const timeLogIds = rawResults.map((entry: TimeLog) => entry.id);

				// Converts TypeORM find options to a format compatible with MikroORM for a given entity.
				const { mikroOptions } = parseTypeORMFindToMikroOrm<TimeLog>({
					...(request.relations ? { relations: request.relations } : {})
				});

				// Get last logs group by employees (running or completed);
				lastLogs = (await this.mikroOrmTimeLogRepository.find({ id: { $in: timeLogIds } }, mikroOptions)).map(
					(item: TimeLog) => wrapSerialize(item)
				);
				break;
			case MultiORMEnum.TypeORM:
				/**
				 * Get last logs (running or completed)
				 */
				const query = this.typeOrmTimeLogRepository.createQueryBuilder('time_log');
				// query.innerJoin(`${query.alias}.timeSlots`, 'timeSlots');
				query.setFindOptions({
					...(request['relations'] ? { relations: parseFindOptionsRelations(request['relations']) } : {})
				});
				query.where({
					startedAt: Not(IsNull()),
					stoppedAt: Not(IsNull()),
					employeeId: In(employeeIds),
					tenantId,
					organizationId,
					isActive: true,
					isArchived: false,
					...(isNotEmpty(source) ? { source } : {}),
					...(isNotEmpty(organizationTeamId) ? { organizationTeamId } : {})
				});
				query.orderBy(p(`"${query.alias}"."employeeId"`), 'ASC'); // Adjust ORDER BY to match the SELECT list
				// The running log first, a row without the flag counting as not running (see the MikroORM branch)
				query.addOrderBy(p(`COALESCE("${query.alias}"."isRunning", false)`), 'DESC');
				query.addOrderBy(p(`"${query.alias}"."startedAt"`), 'DESC');
				query.addOrderBy(p(`"${query.alias}"."createdAt"`), 'DESC');

				// Get last logs group by employees (running or completed)
				lastLogs = await query.distinctOn([p(`"${query.alias}"."employeeId"`)]).getMany();
				break;
			default:
				throw new Error(`Not implemented for ${this.ormType}`);
		}

		/** Transform an array of ITimeLog objects into an array of ITimerStatus objects. */
		const statistics: ITimerStatus[] = lastLogs.map((lastLog: ITimeLog) => {
			const duration = lastLog?.duration ?? 0;
			const running = lastLog?.isRunning ?? false;
			const stoppedAt = lastLog?.stoppedAt ? moment(lastLog.stoppedAt) : moment().subtract(1, 'day'); // Default to 1 day ago if stoppedAt is not present

			// Calculate the timer status
			const timerStatus = running ? 'running' : moment().diff(stoppedAt, 'days') > 0 ? 'idle' : 'pause';

			return {
				duration,
				running,
				lastLog: lastLog ?? null,
				timerStatus
			};
		});

		/**
		 * @returns An array of ITimerStatus objects.
		 */
		return statistics;
	}

	/**
	 * Diagnostic trace of a timer request, at debug level. This runs for every start / stop the trackers
	 * send; the message (with its serialized time log) is built only when debug logging is on.
	 *
	 * @param message - Builds the message to be logged.
	 */
	private debug(message: () => string): void {
		if (Logger.isLevelEnabled('debug')) {
			this.logger.debug(message());
		}
	}

	/**
	 * Stops the running timers of an employee whose time tracking was just turned off, at this moment, as a stop of
	 * their own would. With a team, only a timer running for that team stops. Called for a caller who may change
	 * the employee's tracking (an admin, or the team's manager), so it reads and writes by the ids given rather than
	 * through the caller's employee scope.
	 *
	 * @param scope The employee, their organization and tenant, and the team when tracking was turned off for it only.
	 * @returns The stopped time logs.
	 */
	async stopRunningTimersOf(scope: ITrackingTurnedOffScope): Promise<ITimeLog[]> {
		const { employeeId, organizationId, tenantId, organizationTeamId } = scope;
		const where: FindOptionsWhere<TimeLog> = { employeeId, organizationId, tenantId, isRunning: true };
		if (organizationTeamId) {
			where.organizationTeamId = organizationTeamId;
		}

		const runningLogs = await this.findTimeLogsWhere(where);
		const stoppedAt = moment.utc().toDate();
		const stoppedLogs: ITimeLog[] = [];
		for (const runningLog of runningLogs) {
			const partialTimeLog: Partial<ITimeLog> = { isRunning: false };
			const stopsAfterStart = stoppedAt >= new Date(runningLog.startedAt);
			if (stopsAfterStart) {
				partialTimeLog.stoppedAt = stoppedAt;
			}
			// Each stop on its own: one that fails leaves the others stopped, and those are still returned
			try {
				const stoppedLog = await this._commandBus.execute(
					new TimeLogUpdateCommand(partialTimeLog, runningLog.id)
				);
				stoppedLogs.push(stoppedLog);
			} catch (error) {
				this.logger.warn(`Failed to stop the running time log ${runningLog.id}: ${error?.message}`);
				const storedLog = await this.storedStoppedLog(runningLog.id, tenantId);
				if (storedLog) {
					stoppedLogs.push(storedLog);
				}
			}
		}

		const hasStoppedAny = stoppedLogs.length > 0;
		if (hasStoppedAny) {
			await this.markNotTrackingWhenNothingRuns(employeeId, organizationId, tenantId);
		}
		return stoppedLogs;
	}

	/**
	 * The log as stored after a failed stop, when it no longer runs: the update writes the stop before its later
	 * steps, so a failure after that write still stopped it. Undefined when it still runs or cannot be read.
	 */
	private async storedStoppedLog(timeLogId: ID, tenantId: ID): Promise<ITimeLog | undefined> {
		try {
			const [storedLog] = await this.findTimeLogsWhere({ id: timeLogId, tenantId });
			const wasStopped = storedLog?.isRunning === false;
			if (wasStopped) {
				return storedLog;
			}
		} catch (error) {
			this.logger.warn(`Failed to read back the time log ${timeLogId}: ${error?.message}`);
		}
		return undefined;
	}

	/**
	 * Marks the employee as not tracking once no timer of theirs runs: turned off for one team, a timer of another
	 * team may still run. Left as it is when that cannot be read.
	 */
	private async markNotTrackingWhenNothingRuns(employeeId: ID, organizationId: ID, tenantId: ID): Promise<void> {
		try {
			const stillRunning = await this.findTimeLogsWhere({
				employeeId,
				organizationId,
				tenantId,
				isRunning: true
			});
			const hasNoTimerLeft = stillRunning.length === 0;
			if (hasNoTimerLeft) {
				await this.markNotTracking(employeeId, organizationId, tenantId);
			}
		} catch (error) {
			this.logger.warn(`Failed to read the running timers of employee ${employeeId}: ${error?.message}`);
		}
	}

	/**
	 * Marks the employee as not tracking after their stop, as a stop always did, unless a run of theirs is still
	 * going: one another client started while the stop ran, which the stop leaves going. When the running timers
	 * cannot be read, the employee is marked as before.
	 */
	private async markNotTrackingAfterStop(employeeId: ID, organizationId: ID, tenantId: ID): Promise<void> {
		try {
			const stillRunning = await this.findTimeLogsWhere({
				employeeId,
				organizationId,
				tenantId,
				isRunning: true
			});
			const isStillTracking = stillRunning.length > 0;
			if (isStillTracking) {
				return;
			}
		} catch (error) {
			this.logger.warn(`Failed to read the running timers of employee ${employeeId}: ${error?.message}`);
		}
		await this._employeeService.update(employeeId, { isOnline: false, isTrackingTime: false });
	}

	private async findTimeLogsWhere(where: FindOptionsWhere<TimeLog>): Promise<ITimeLog[]> {
		switch (this.ormType) {
			case MultiORMEnum.MikroORM: {
				const findOptions = parseTypeORMFindToMikroOrm<TimeLog>({ where });
				const items = await this.mikroOrmTimeLogRepository.findAll(findOptions);
				return items.map((entity: TimeLog) => wrapSerialize(entity)) as TimeLog[];
			}
			case MultiORMEnum.TypeORM:
			default:
				return await this.typeOrmTimeLogRepository.find({ where });
		}
	}

	private async markNotTracking(employeeId: ID, organizationId: ID, tenantId: ID): Promise<void> {
		const employee = { id: employeeId, organizationId, tenantId };
		const status = { isOnline: false, isTrackingTime: false };
		try {
			switch (this.ormType) {
				case MultiORMEnum.MikroORM:
					await this.mikroOrmEmployeeRepository.nativeUpdate(employee, status);
					return;
				case MultiORMEnum.TypeORM:
				default:
					await this.typeOrmEmployeeRepository.update(employee, status);
			}
		} catch (error) {
			this.logger.warn(`Failed to mark employee ${employeeId} as not tracking: ${error?.message}`);
		}
	}
}
