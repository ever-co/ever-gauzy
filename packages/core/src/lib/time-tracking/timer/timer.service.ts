import {
	Injectable,
	Logger,
	NotFoundException,
	ForbiddenException,
	NotAcceptableException,
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
	TimeLogUpdateCommand
} from '../time-log/commands';
import {
	assertRequiredContext,
	projectIdForEntry,
	teamIdForEntry
} from '../time-log/organization-tracking-requirements';
import { isTrackerSource } from '../time-log/tracker-source';
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
import {
	DAILY_PLAN_REQUIRED,
	PLAN_RULE_SOURCES,
	TASK_NOT_PLANNED,
	planDatesAroundToday,
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
			source
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

		// Stop any previous running timers
		await this.stopPreviousRunningTimers(employeeId, organizationId, tenantId);

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

		// Update the employee's tracking status to reflect they are now tracking time
		await this._employeeService.update(employeeId, {
			isOnline: true,
			isTrackingTime: true
		});

		this.debug(() => `last created time log: ${JSON.stringify(timeLog)}`);

		// Return the newly created time log entry
		return timeLog;
	}

	/**
	 * Refuses an Ever Teams start for a team that requires a daily plan when the employee has no plan with tasks
	 * around today in that team, or when the task they start is in none of those plans. Ever Teams web checks the
	 * same before starting; the mobile app and older web tabs did not, and the rule stayed advisory.
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
	}): Promise<void> {
		const { employeeId, organizationId, tenantId, organizationTeamId, taskId, source } = start;
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

		const { from, to } = planDatesAroundToday(moment.utc());
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

		// Fetch the employee details. Turning tracking off does not refuse the stop: a timer still running when an
		// admin turned it off could otherwise never be stopped, and would keep counting time
		const employee = await this.findEmployee();

		// Retrieve tenant ID
		const tenantId = RequestContext.currentTenantId() ?? request.tenantId;
		// Retrieve the employee ID and organization ID
		const { id: employeeId, organizationId } = employee;

		// Retrieve the last running log
		const includeTimeSlots = true;
		let lastLog = await this.getLastRunningLog(includeTimeSlots);

		// If no running log is found, throw a NotAcceptableException
		if (!lastLog) {
			this.logger.warn(`No running log found. Can't stop timer because it was already stopped.`);
			throw new NotAcceptableException(`No running log found. Can't stop timer because it was already stopped.`);
		}

		// Calculate stoppedAt date or use current date if not provided
		const stoppedAt = await this.calculateStoppedAt(request, lastLog);
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

		// Execute the command to update the time log entry
		lastLog = await this._commandBus.execute(
			new TimeLogUpdateCommand(partialTimeLog, lastLog.id, request.manualTimeSlot)
		);

		// Update the employee's tracking status to reflect they are now tracking time
		await this._employeeService.update(employeeId, {
			isOnline: false, // Employee status (Online/Offline)
			isTrackingTime: false // Employee time tracking status
		});

		// Stop previous running timers
		await this.stopPreviousRunningTimers(employeeId, organizationId, tenantId);

		// Handle conflicting time logs
		await this.handleConflictingTimeLogs(lastLog, tenantId, organizationId);

		// Return the last log
		return lastLog;
	}

	/**
	 * Handles any conflicting time logs that overlap with the current time log entry.
	 *
	 * @param lastLog The last running time log entry.
	 * @param tenantId The tenant ID.
	 * @param organizationId The organization ID.
	 * @param forceDelete Flag indicating whether to force delete the conflicts.
	 */
	private async handleConflictingTimeLogs(
		lastLog: ITimeLog,
		tenantId: ID,
		organizationId: ID,
		forceDelete: boolean = false
	): Promise<void> {
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
	 * Calculates the stoppedAt time for the current time log based on the request and the last running time log.
	 * It adjusts the stoppedAt time based on various conditions, such as the time log source (e.g., DESKTOP) and time slots.
	 *
	 * - If the source is DESKTOP and the last time slot was created more than 10 minutes ago,
	 *   the stoppedAt time is adjusted based on the last time slot's duration.
	 * - If no time slots exist and the last log's startedAt time exceeds 10 minutes from the current time,
	 *   the stoppedAt time is adjusted by 10 seconds from the startedAt time.
	 *
	 * @param {ITimerToggleInput} request - The input data for stopping the timer, including stoppedAt and source.
	 * @param {ITimeLog} lastLog - The last running time log, which may include time slots for more detailed tracking.
	 * @returns {Promise<Date>} - A promise that resolves to the calculated stoppedAt date, adjusted as necessary.
	 */
	async calculateStoppedAt(request: ITimerToggleInput, lastLog: ITimeLog): Promise<Date> {
		// Retrieve stoppedAt date or default to the current date if not provided
		let stoppedAt = moment.utc(request.stoppedAt ?? moment.utc()).toDate();

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
	 * Toggle time tracking start/stop
	 *
	 * @param request The timer toggle request input
	 * @returns The started or stopped TimeLog
	 */
	async toggleTimeLog(request: ITimerToggleInput): Promise<TimeLog> {
		// Retrieve the last running time log
		const lastLog = await this.getLastRunningLog();

		// Start a new timer if no running log exists, otherwise stop the current timer
		if (!lastLog) {
			return this.startTimer(request);
		} else {
			return this.stopTimer(request);
		}
	}

	/**
	 * Stops all previous running timers for the specified employee.
	 *
	 * @param employeeId - The ID of the employee whose timers need to be stopped
	 * @param organizationId - The ID of the organization to which the employee belongs
	 * @param tenantId - The ID of the tenant context
	 */
	async stopPreviousRunningTimers(employeeId: ID, organizationId: ID, tenantId: ID): Promise<void> {
		try {
			this.debug(() => 'Start previous running timers...');
			// Retrieve any existing running logs for the employee
			const logs = await this.getLastRunningLogs();
			this.debug(() => `Last Running Logs Count: ${logs.length}`);

			// If there are existing running logs, stop them before starting a new one
			if (logs.length > 0) {
				// Execute the ScheduleTimeLogEntriesCommand to stop all previous running timers
				await this._commandBus.execute(new ScheduleTimeLogEntriesCommand(employeeId, organizationId, tenantId));
			}
			this.debug(() => 'Stop previous running timers...');
		} catch (error) {
			// Log the error or handle it appropriately
			this.logger.warn(`Failed to stop previous running timers: ${error?.message}`);
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
					...(includeTimeSlots && !fetchAll ? { relations: { timeSlots: true } } : {})
				});

				if (fetchAll) {
					const items = await this.mikroOrmTimeLogRepository.findAll(findOptions);
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
							order: { startedAt: 'DESC', createdAt: 'DESC' }
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
	 * @returns An array of pending time logs
	 */
	private async getLastRunningLogs(): Promise<ITimeLog[]> {
		// Retrieve the last running log by using the `getRunningLogs` method with `fetchAll` set to false
		const logs = await this.getRunningLogs(true);

		// Ensure that the returned logs are of type ITimeLog[]
		return logs as ITimeLog[];
	}

	/**
	 * Get timer worked status
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

				// Adds ordering to the SQL query.
				sqlQuery = sqlQuery.orderBy([
					{ column: 'employeeId', order: 'ASC' },
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
