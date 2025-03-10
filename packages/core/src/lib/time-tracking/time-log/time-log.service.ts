import { Injectable, BadRequestException, NotAcceptableException, Logger } from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import { SelectQueryBuilder, Brackets, WhereExpressionBuilder, DeleteResult, UpdateResult } from 'typeorm';
import { chain, pluck } from 'underscore';
import {
	IManualTimeInput,
	PermissionsEnum,
	IDateRange,
	IGetTimeLogReportInput,
	ITimeLog,
	TimeLogType,
	IAmountOwedReport,
	IGetTimeLimitReportInput,
	ITimeLimitReport,
	IProjectBudgetLimitReport,
	OrganizationProjectBudgetTypeEnum,
	OrganizationContactBudgetTypeEnum,
	IClientBudgetLimitReport,
	ReportGroupFilterEnum,
	IOrganizationProject,
	IDeleteTimeLog,
	IOrganizationContact,
	IEmployee,
	IOrganization,
	ID,
	BaseEntityEnum,
	ActionTypeEnum,
	ActorTypeEnum,
	ITimeLogActivity,
	IReportDayData,
	IReportWeeklyData,
	IReportWeeklyDate,
	IAmountOwedReportChart,
	IDailyReportChart
} from '@gauzy/contracts';
import { isEmpty, isNotEmpty } from '@gauzy/common';
import { TenantAwareCrudService } from './../../core/crud';
import {
	DeleteTimeSpanCommand,
	GetTimeLogGroupByClientCommand,
	GetTimeLogGroupByDateCommand,
	GetTimeLogGroupByEmployeeCommand,
	GetTimeLogGroupByProjectCommand,
	IGetConflictTimeLogCommand,
	TimeLogCreateCommand,
	TimeLogDeleteCommand,
	TimeLogUpdateCommand
} from './commands';
import { getDateRangeFormat, getDaysBetweenDates } from './../../core/utils';
import { RequestContext } from '../../core/context';
import { moment } from './../../core/moment-extend';
import { calculateAverage, calculateAverageActivity, calculateDuration } from './time-log.utils';
import { prepareSQLQuery as p } from './../../database/database.helper';
import { TypeOrmTimeLogRepository } from './repository/type-orm-time-log.repository';
import { MikroOrmTimeLogRepository } from './repository/mikro-orm-time-log.repository';
import { TypeOrmEmployeeRepository } from '../../employee/repository/type-orm-employee.repository';
import { MikroOrmEmployeeRepository } from '../../employee/repository/mikro-orm-employee.repository';
import { TypeOrmOrganizationProjectRepository } from '../../organization-project/repository/type-orm-organization-project.repository';
import { MikroOrmOrganizationProjectRepository } from '../../organization-project/repository/mikro-orm-organization-project.repository';
import { TypeOrmOrganizationContactRepository } from '../../organization-contact/repository/type-orm-organization-contact.repository';
import { MikroOrmOrganizationContactRepository } from '../../organization-contact/repository/mikro-orm-organization-contact.repository';
import { TimeLog } from './time-log.entity';
import { ActivityLogService } from '../../activity-log/activity-log.service';

@Injectable()
export class TimeLogService extends TenantAwareCrudService<TimeLog> {
	private readonly logger = new Logger(`GZY - ${TimeLogService.name}`);
	constructor(
		readonly typeOrmTimeLogRepository: TypeOrmTimeLogRepository,
		readonly mikroOrmTimeLogRepository: MikroOrmTimeLogRepository,
		readonly typeOrmEmployeeRepository: TypeOrmEmployeeRepository,
		readonly mikroOrmEmployeeRepository: MikroOrmEmployeeRepository,
		readonly typeOrmOrganizationProjectRepository: TypeOrmOrganizationProjectRepository,
		readonly mikroOrmOrganizationProjectRepository: MikroOrmOrganizationProjectRepository,
		readonly typeOrmOrganizationContactRepository: TypeOrmOrganizationContactRepository,
		readonly mikroOrmOrganizationContactRepository: MikroOrmOrganizationContactRepository,
		private readonly commandBus: CommandBus,
		private readonly activityLogService: ActivityLogService
	) {
		super(typeOrmTimeLogRepository, mikroOrmTimeLogRepository);
	}

	/**
	 * Retrieves the time logs activity report based on the provided input parameters.
	 * @param request - Input parameters for querying the time logs report.
	 * @returns A map of time log id to its activity percentage.
	 */
	async getTimeLogReportActivity(request: IGetTimeLogReportInput): Promise<Record<string, number>> {
		// Create a query builder for the TimeLog entity
		const query = this.typeOrmRepository.createQueryBuilder('time_log');

		query.select([
			p(`"${query.alias}"."id" AS "id"`),
			p(`SUM("timeSlots"."overall") AS "overall"`),
			p(`SUM("timeSlots"."duration") AS "duration"`)
		]);

		// Inner join with related entities (timeSlots)
		query.innerJoin(`${query.alias}.timeSlots`, 'timeSlots');

		// Apply additional conditions to the query based on request filters
		query.where((qb: SelectQueryBuilder<TimeLog>) => {
			this.getFilterTimeLogQuery(qb, request);
		});

		// Add values aggregation grouping by time_log.id and sum the timeSlots overall and duration values
		// Prevent requiring to return the whole timeslot entries in the result
		query.groupBy(`"${query.alias}"."id"`);

		// Execute the query and retrieve time logs
		const logs = await query.getRawMany<ITimeLogActivity>();

		// Prepare the log activity map
		const logActivity = {};
		logs.forEach((log) => {
			logActivity[log.id] = (log.overall * 100) / log.duration || 0;
		});

		// Return the generated daily time logs report
		return logActivity;
	}

	/**
	 * Retrieves time logs based on the provided input.
	 * @param request The input parameters for fetching time logs.
	 * @returns A Promise that resolves to an array of time logs.
	 */
	async getTimeLogs(request: IGetTimeLogReportInput): Promise<ITimeLog[]> {
		// Create a query builder for the TimeLog entity
		const query = this.typeOrmRepository.createQueryBuilder(this.tableName);

		// Inner join with related entities (employee, timeSlots)
		query.innerJoin(`${query.alias}.employee`, 'employee');

		// Set up the find options for the query
		query.setFindOptions({
			select: {
				project: {
					id: true,
					name: true,
					imageUrl: true,
					membersCount: true
				},
				task: TimeLogService.TASK_SELECT_FIELDS,
				organizationContact: {
					id: true,
					name: true,
					imageUrl: true
				},
				employee: {
					id: true,
					isAway: true,
					isOnline: true,
					user: {
						id: true,
						firstName: true,
						lastName: true,
						imageUrl: true
					}
				}
			},
			relations: [...(request.relations ? request.relations : [])],
			order: {
				// Order results by the 'startedAt' field in ascending order
				startedAt: 'ASC'
			}
		});

		// Set up the where clause using the provided filter function
		query.where((qb: SelectQueryBuilder<TimeLog>) => {
			this.getFilterTimeLogQuery(qb, request, true);
		});

		const timeLogs = await query.getMany();

		// Set up the where clause using the provided filter function
		return timeLogs;
	}

	/**
	 * Retrieves time logs for invoice based on the provided input.
	 * @param request The input parameters for fetching time logs.
	 * @returns A Promise that resolves to an array of time logs.
	 */
	async getInvoiceLogs(request: IGetTimeLogReportInput): Promise<IReportDayData> {
		// Extract timezone from the request
		const { timeZone } = request;

		const timeLogs = await this.getTimeLogs(request);

		// Group time logs based on the specified 'groupBy' filter
		let invoiceData: IReportDayData;
		switch (request.groupBy) {
			case ReportGroupFilterEnum.employee:
				invoiceData = await this.commandBus.execute(
					new GetTimeLogGroupByEmployeeCommand(timeLogs, {}, timeZone)
				);
				break;
			case ReportGroupFilterEnum.project:
				invoiceData = await this.commandBus.execute(
					new GetTimeLogGroupByProjectCommand(timeLogs, {}, timeZone)
				);
				break;
			case ReportGroupFilterEnum.client:
				invoiceData = await this.commandBus.execute(new GetTimeLogGroupByClientCommand(timeLogs, {}, timeZone));
				break;
			default:
				invoiceData = await this.commandBus.execute(new GetTimeLogGroupByDateCommand(timeLogs, {}, timeZone));
				break;
		}

		return invoiceData;
	}

	/**
	 * Fetches time logs for a weekly report based on the provided input.
	 * @param request The input parameters for fetching time logs.
	 * @returns A Promise that resolves to an array of weekly report data.
	 */
	async getWeeklyReport(request: IGetTimeLogReportInput) {
		// Create a query builder for the TimeLog entity
		const query = this.typeOrmRepository.createQueryBuilder('time_log');

		// Set find options for the query
		query.setFindOptions({
			select: {
				// Selected fields for the result
				id: true,
				employeeId: true,
				startedAt: true,
				stoppedAt: true,
				employee: {
					id: true,
					userId: true,
					isAway: true,
					isOnline: true,
					user: {
						id: true,
						firstName: true,
						lastName: true,
						imageUrl: true
					}
				}
			},
			relations: {
				// Related entities to be included in the result
				employee: {
					user: true
				}
			},
			order: {
				// Order results by the 'startedAt' field in ascending order
				startedAt: 'ASC'
			}
		});
		// Apply additional conditions to the query based on request filters
		query.where((qb: SelectQueryBuilder<TimeLog>) => {
			this.getFilterTimeLogQuery(qb, request, true);
		});

		// Execute the query and retrieve time logs
		const logs = await query.getMany();

		// Get the time logs activity report
		const logActivity = await this.getTimeLogReportActivity(request);

		// Gets an array of days between the given start date, end date and timezone.
		const { startDate, endDate, timeZone } = request;
		const days: Array<string> = getDaysBetweenDates(startDate, endDate, timeZone);

		// Process weekly logs using lodash and Moment.js
		const weeklyLogs: IReportWeeklyData[] = chain(logs)
			.groupBy('employeeId')
			.map((logs: ITimeLog[]) => {
				// Calculate average duration for specific employee.
				const weeklyDuration = calculateAverage(pluck(logs, 'duration'));

				// Calculate average weekly activity for specific employee.
				const weeklyActivity = calculateAverageActivity(logs, logActivity);

				const byDate = chain(logs)
					.groupBy((log: ITimeLog) => moment.utc(log.startedAt).tz(timeZone).format('YYYY-MM-DD'))
					.mapObject((logs: ITimeLog[]) => {
						// Calculate average duration of the employee for specific date range.
						const sum = calculateAverage(pluck(logs, 'duration'));
						return { sum, logs };
					})
					.value();

				// Retrieve employee details
				const employee = logs.length > 0 ? logs[0].employee : null;

				const dates: Record<string, IReportWeeklyDate | number> = {};
				days.forEach((date) => {
					dates[date] = byDate[date] || 0;
				});

				// Return the processed weekly logs data
				return {
					employee,
					dates,
					sum: weeklyDuration || null,
					activity: parseFloat(parseFloat(weeklyActivity + '').toFixed(2))
				};
			})
			.value();

		return weeklyLogs;
	}

	/**
	 * Fetches daily time logs for chart reports based on the provided input.
	 * @param request The input parameters for fetching daily time logs.
	 * @returns An array of daily time log chart reports.
	 */
	async getDailyReportCharts(request: IGetTimeLogReportInput): Promise<IDailyReportChart[]> {
		// Create a query builder for the TimeLog entity
		const query = this.typeOrmRepository.createQueryBuilder('time_log');

		// Inner join with related entities (employee, timeSlots)
		query.innerJoin(`${query.alias}.employee`, 'employee');
		query.innerJoin(`${query.alias}.timeSlots`, 'timeSlots');

		// Set find options for the query
		query.setFindOptions({
			order: {
				// Order results by the 'startedAt' field in ascending order
				startedAt: 'ASC'
			}
		});
		// Apply additional conditions to the query based on request filters
		query.where((qb: SelectQueryBuilder<TimeLog>) => {
			this.getFilterTimeLogQuery(qb, request);
		});

		// Execute the query and retrieve time logs
		const logs = await query.getMany();

		// Gets an array of days between the given start date, end date and timezone.
		const { startDate, endDate, timeZone } = request;
		const days: Array<string> = getDaysBetweenDates(startDate, endDate, timeZone);

		// Group time logs by date and calculate tracked, manual, idle, and resumed durations
		const byDate = chain(logs)
			.groupBy((log: ITimeLog) => moment.utc(log.startedAt).tz(timeZone).format('YYYY-MM-DD'))
			.mapObject((logs: ITimeLog[], date) => {
				const tracked = calculateDuration(logs, TimeLogType.TRACKED); //
				const manual = calculateDuration(logs, TimeLogType.MANUAL); //
				const ideal = calculateDuration(logs, TimeLogType.IDLE); //
				const resumed = calculateDuration(logs, TimeLogType.RESUMED); //

				return {
					date,
					value: {
						[TimeLogType.TRACKED]: parseFloat((tracked / 3600).toFixed(1)),
						[TimeLogType.MANUAL]: parseFloat((manual / 3600).toFixed(1)),
						[TimeLogType.IDLE]: parseFloat((ideal / 3600).toFixed(1)),
						[TimeLogType.RESUMED]: parseFloat((resumed / 3600).toFixed(1))
					}
				};
			})
			.value();

		// Map the calculated values to each date, ensuring no missing dates
		const dates = days.map((date) => {
			return (
				byDate[date] || {
					date,
					value: {
						[TimeLogType.TRACKED]: 0,
						[TimeLogType.MANUAL]: 0,
						[TimeLogType.IDLE]: 0,
						[TimeLogType.RESUMED]: 0
					}
				}
			);
		});

		// Return the array of daily time log chart reports
		return dates;
	}

	/**
	 * Retrieves a daily time logs report based on the provided input parameters.
	 * @param request - Input parameters for querying the daily time logs report.
	 * @returns A report containing time logs grouped by specified filters.
	 */
	async getDailyReport(request: IGetTimeLogReportInput) {
		// Extract timezone from the request
		const { timeZone } = request;

		// Create a query builder for the TimeLog entity
		const query = this.typeOrmRepository.createQueryBuilder('time_log');

		// Set find options for the query
		query.setFindOptions({
			select: {
				// Selected fields for the result
				id: true,
				employeeId: true,
				startedAt: true,
				stoppedAt: true,
				description: true,
				projectId: true,
				taskId: true,
				organizationContactId: true,
				project: {
					id: true,
					name: true,
					imageUrl: true,
					membersCount: true,
					organizationContact: {
						id: true,
						name: true,
						imageUrl: true
					}
				},
				task: TimeLogService.TASK_SELECT_FIELDS,
				organizationContact: {
					id: true,
					name: true,
					imageUrl: true
				},
				employee: {
					id: true,
					userId: true,
					isAway: true,
					isOnline: true,
					user: {
						id: true,
						firstName: true,
						lastName: true,
						imageUrl: true
					}
				}
			},
			relations: {
				// Related entities to be included in the result
				project: { organizationContact: true },
				task: { taskStatus: true },
				organizationContact: true,
				employee: { user: true }
			},
			order: {
				// Order results by the 'startedAt' field in ascending order
				startedAt: 'ASC'
			}
		});
		// Apply additional conditions to the query based on request filters
		query.where((qb: SelectQueryBuilder<TimeLog>) => {
			this.getFilterTimeLogQuery(qb, request, true);
		});

		// Execute the query and retrieve time logs
		const logs = await query.getMany();

		// Get the time logs activity report
		const logActivity = await this.getTimeLogReportActivity(request);

		// Group time logs based on the specified 'groupBy' filter
		let dailyLogs: IReportDayData;
		switch (request.groupBy) {
			case ReportGroupFilterEnum.employee:
				dailyLogs = await this.commandBus.execute(
					new GetTimeLogGroupByEmployeeCommand(logs, logActivity, timeZone)
				);
				break;
			case ReportGroupFilterEnum.project:
				dailyLogs = await this.commandBus.execute(
					new GetTimeLogGroupByProjectCommand(logs, logActivity, timeZone)
				);
				break;
			case ReportGroupFilterEnum.client:
				dailyLogs = await this.commandBus.execute(
					new GetTimeLogGroupByClientCommand(logs, logActivity, timeZone)
				);
				break;
			default:
				dailyLogs = await this.commandBus.execute(
					new GetTimeLogGroupByDateCommand(logs, logActivity, timeZone)
				);
				break;
		}

		// Return the generated daily time logs report
		return dailyLogs;
	}

	/**
	 * Fetches an owed amount report based on the provided input.
	 * @param request The input parameters for fetching the owed amount report.
	 * @returns A Promise that resolves to an array of owed amount report data.
	 */
	async getOwedAmountReport(request: IGetTimeLogReportInput): Promise<IAmountOwedReport[]> {
		// Extract timezone from the request
		const { timeZone } = request;

		// Create a query builder for the TimeLog entity
		const query = this.typeOrmRepository.createQueryBuilder('time_log');

		// Inner join with related entities (employee, timeSlots)
		query.innerJoin(`${query.alias}.employee`, 'employee');
		query.innerJoin(`${query.alias}.timeSlots`, 'timeSlots');

		// Set up the find options for the query
		query.setFindOptions({
			select: {
				employee: {
					id: true,
					userId: true,
					isAway: true,
					isOnline: true,
					billRateValue: true,
					user: {
						id: true,
						firstName: true,
						lastName: true,
						imageUrl: true
					}
				}
			},
			relations: {
				// Related entities to be included in the result
				employee: {
					user: true
				}
			},
			order: {
				// Order results by the 'startedAt' field in ascending order
				startedAt: 'ASC'
			}
		});

		// Apply additional conditions to the query based on request filters
		query.where((qb: SelectQueryBuilder<TimeLog>) => {
			this.getFilterTimeLogQuery(qb, request);
		});

		// Execute the query and retrieve time logs
		const timeLogs = await query.getMany();

		const dailyLogs = chain(timeLogs)
			.groupBy((log) => moment.utc(log.startedAt).tz(timeZone).format('YYYY-MM-DD'))
			.map((byDateLogs: ITimeLog[], date: string) => {
				const byEmployee = chain(byDateLogs)
					.groupBy('employeeId')
					.map((byEmployeeLogs: ITimeLog[]) => {
						// Calculate average duration for specific employee.
						const durationSum = calculateAverage(pluck(byEmployeeLogs, 'duration'));

						// Retrieve employee details
						const employee = byEmployeeLogs.length > 0 ? byEmployeeLogs[0].employee : null;
						const amount = employee?.billRateValue * (durationSum / 3600);

						return {
							employee,
							amount: parseFloat(amount.toFixed(1)),
							duration: durationSum
						};
					})
					.value();

				return {
					date,
					employees: byEmployee
				};
			})
			.value();

		return dailyLogs;
	}

	/**
	 * Fetches owed amount report data for charts based on the provided input.
	 * @param request The input parameters for fetching owed amount report charts.
	 * @returns An array of owed amount report chart data.
	 */
	async getOwedAmountReportCharts(request: IGetTimeLogReportInput): Promise<IAmountOwedReportChart[]> {
		// Step 1: Create a query builder for the TimeLog entity
		const query = this.typeOrmRepository.createQueryBuilder('time_log');

		// Inner join with related entities (employee, timeSlots)
		query.innerJoin(`${query.alias}.employee`, 'employee');
		query.innerJoin(`${query.alias}.timeSlots`, 'timeSlots');

		// Set find options for the query
		query.setFindOptions({
			select: {
				// Selected fields for the result
				employee: {
					id: true,
					billRateValue: true,
					userId: true,
					isAway: true,
					isOnline: true,
					user: {
						id: true,
						firstName: true,
						lastName: true,
						imageUrl: true
					}
				}
			},
			relations: {
				employee: {
					user: true
				}
			},
			order: {
				// Order results by the 'startedAt' field in ascending order
				startedAt: 'ASC'
			}
		});
		// Apply additional conditions to the query based on request filters
		query.where((qb: SelectQueryBuilder<TimeLog>) => {
			this.getFilterTimeLogQuery(qb, request);
		});

		// Execute the query and retrieve time logs
		const timeLogs = await query.getMany();

		// Gets an array of days between the given start date, end date and timezone.
		const { startDate, endDate, timeZone } = request;
		const days: Array<string> = getDaysBetweenDates(startDate, endDate, timeZone);

		const byDate = chain(timeLogs)
			.groupBy((log: ITimeLog) => moment.utc(log.startedAt).tz(timeZone).format('YYYY-MM-DD'))
			.mapObject((byDateLogs: ITimeLog[], date) => {
				const byEmployee = chain(byDateLogs)
					.groupBy('employeeId')
					.map((byEmployeeLogs: ITimeLog[]) => {
						// Calculate average duration for specific employee.
						const durationSum = calculateAverage(pluck(byEmployeeLogs, 'duration'));

						// Retrieve employee details
						const employee = byEmployeeLogs.length > 0 ? byEmployeeLogs[0].employee : null;

						// Calculate the owed amount based on the employee's bill rate and duration
						const amount = employee?.billRateValue * (durationSum / 3600);

						return {
							employee,
							amount: parseFloat(amount.toFixed(1)),
							duration: durationSum
						};
					})
					.value();

				// Calculate the total owed amount for all employees on a specific date
				const value = byEmployee.reduce((iteratee, item) => {
					return iteratee + item.amount;
				}, 0);

				return { date, value };
			})
			.value();

		// Map the result to an array of owed amount report chart data
		const dates = days.map((date) => ({
			date,
			value: byDate[date]?.value || 0
		}));

		// Return the array of owed amount report chart data
		return dates;
	}

	/**
	 * It retrieves time log data, processes it, and calculates time limits for each employee based on the specified duration (day, month, etc.).
	 * @param request - An object containing input parameters for the time limit report.
	 * @returns An array of ITimeLimitReport containing information about time limits and durations for each date and employee.
	 */
	async getTimeLimit(request: IGetTimeLimitReportInput) {
		// Set a default duration ('day') if not provided in the request.
		if (!request.duration) {
			request.duration = 'day';
		}

		// Create a query builder for the TimeLog entity
		const query = this.typeOrmRepository.createQueryBuilder(this.tableName);

		// Inner join with related entities (employee, timeSlots)
		query.innerJoin(`${query.alias}.employee`, 'employee');
		query.innerJoin(`${query.alias}.timeSlots`, 'timeSlots');

		// Set find options for the query
		query.setFindOptions({
			select: {
				// Specify the fields to be selected in the query result.
				employee: {
					id: true,
					reWeeklyLimit: true,
					userId: true,
					isOnline: true,
					isAway: true,
					user: {
						id: true,
						firstName: true,
						lastName: true,
						imageUrl: true
					}
				}
			},
			relations: {
				employee: {
					user: true
				}
			},
			order: {
				// Order results by the 'startedAt' field in ascending order
				startedAt: 'ASC'
			}
		});
		// Apply additional conditions to the query based on request filters
		query.where((qb: SelectQueryBuilder<TimeLog>) => {
			this.getFilterTimeLogQuery(qb, request);
		});

		// Execute the query and retrieve time logs
		const timeLogs = await query.getMany();

		// Gets an array of days between the given start date, end date and timezone.
		const { startDate, endDate, timeZone } = request;
		const days: Array<string> = getDaysBetweenDates(startDate, endDate, timeZone);

		// Process time log data and calculate time limits for each employee and date
		const byDate = chain(timeLogs)
			.groupBy((log) => moment.utc(log.startedAt).tz(timeZone).startOf(request.duration).format('YYYY-MM-DD'))
			.mapObject((byDateLogs: ITimeLog[], date) => {
				const byEmployee = chain(byDateLogs)
					.groupBy('employeeId')
					.map((byEmployeeLogs: ITimeLog[]) => {
						// Calculate average duration for specific employee.
						const durationSum = calculateAverage(pluck(byEmployeeLogs, 'duration'));

						// Retrieve employee details
						const employee = byEmployeeLogs.length > 0 ? byEmployeeLogs[0].employee : null;

						let limit = employee ? employee.reWeeklyLimit * 60 * 60 : 0;

						// Define a mapping object for duration multipliers
						const multipliers = {
							day: 1 / 5,
							month: 4
						};

						// Check if the requested duration is in the mapping object
						if (request.duration in multipliers) {
							const durationMultiplier = multipliers[request.duration];

							// Update the limit using the corresponding multiplier
							limit *= durationMultiplier;
						}

						// Calculate duration percentage, handling the case where limit is 0
						const durationPercentage = limit !== 0 ? (durationSum * 100) / limit : 0;

						return {
							employee,
							duration: durationSum,
							durationPercentage: Number.isFinite(durationPercentage) ? durationPercentage.toFixed(2) : 0,
							limit
						};
					})
					.value();

				return { date, employees: byEmployee };
			})
			.value();

		// Create an array of ITimeLimitReport for each date.
		const dates = days.map((date) => (byDate[date] ? byDate[date] : { date, employees: [] }));

		// Return the final result as an array of ITimeLimitReport.
		return dates as ITimeLimitReport[];
	}

	/**
	 * Fetches project budget limit report data based on the provided input.
	 * @param request The input parameters for fetching project budget limit report data.
	 * @returns An array of project budget limit report data.
	 */
	async getProjectBudgetLimit(request: IGetTimeLogReportInput) {
		const { organizationId, employeeIds = [], projectIds = [], startDate, endDate } = request;
		const tenantId = RequestContext.currentTenantId() || request.tenantId;

		// Step 1: Create a query builder for the OrganizationProject entity
		const query = this.typeOrmOrganizationProjectRepository.createQueryBuilder('organization_project');

		// Inner join with related entities (employee, timeLogs)
		query.innerJoin(`${query.alias}.timeLogs`, 'timeLogs');
		query.innerJoin(`timeLogs.employee`, 'employee');

		// Set find options for the query
		query.setFindOptions({
			select: {
				id: true,
				name: true,
				budget: true,
				budgetType: true,
				imageUrl: true,
				membersCount: true
			},
			relations: {
				timeLogs: {
					employee: true
				}
			}
		});
		query.andWhere(
			new Brackets((qb: WhereExpressionBuilder) => {
				qb.andWhere(p(`"${query.alias}"."organizationId" =:organizationId`), {
					organizationId
				});
				qb.andWhere(p(`"${query.alias}"."tenantId" =:tenantId`), {
					tenantId
				});
			})
		);
		query.andWhere(
			new Brackets((qb: WhereExpressionBuilder) => {
				qb.andWhere(p(`"employee"."organizationId" =:organizationId`), {
					organizationId
				});
				qb.andWhere(p(`"employee"."tenantId" =:tenantId`), {
					tenantId
				});
				if (isNotEmpty(employeeIds)) {
					qb.andWhere(p(`"employee"."id" IN (:...employeeIds)`), {
						employeeIds
					});
				}
			})
		);
		query.andWhere(
			new Brackets((qb: WhereExpressionBuilder) => {
				qb.andWhere(p(`"timeLogs"."organizationId" =:organizationId`), {
					organizationId
				});
				qb.andWhere(p(`"timeLogs"."tenantId" =:tenantId`), { tenantId });

				// Date range condition
				const { start, end } = getDateRangeFormat(moment.utc(startDate), moment.utc(endDate));
				qb.andWhere(p(`"timeLogs"."startedAt" >= :startDate AND "timeLogs"."startedAt" < :endDate`), {
					startDate: start,
					endDate: end
				});

				if (isNotEmpty(employeeIds)) {
					qb.andWhere(p(`"timeLogs"."employeeId" IN (:...employeeIds)`), {
						employeeIds
					});
				}
				if (isNotEmpty(projectIds)) {
					qb.andWhere(p(`"timeLogs"."projectId" IN (:...projectIds)`), {
						projectIds
					});
				}
			})
		);

		// Execute the query and retrieve organization projects
		const organizationProjects = await query.getMany();

		const projects = organizationProjects.map(
			(organizationProject: IOrganizationProject): IProjectBudgetLimitReport => {
				const { budgetType, timeLogs = [] } = organizationProject;
				const budget = organizationProject.budget || 0;

				let spent = 0;
				let spentPercentage = 0;
				let remainingBudget = 0;

				if (budgetType == OrganizationProjectBudgetTypeEnum.HOURS) {
					spent = timeLogs.reduce(
						(totalDuration: number, log: ITimeLog) => totalDuration + log.duration / 3600,
						0
					);
				} else {
					spent = timeLogs.reduce((totalAmount: number, log: ITimeLog) => {
						const logAmount = log.employee ? (log.duration / 3600) * log.employee.billRateValue : 0;
						return totalAmount + logAmount;
					}, 0);
				}

				spentPercentage = (spent * 100) / budget;
				remainingBudget = Math.max(budget - spent, 0);

				// Remove timeLogs property from the organizationProject object
				// eslint-disable-next-line @typescript-eslint/no-unused-vars
				const { timeLogs: _, ...projectWithoutTimeLogs } = organizationProject;

				return {
					project: projectWithoutTimeLogs,
					budgetType,
					budget,
					spent: parseFloat(spent.toFixed(2)),
					remainingBudget: Number.isFinite(remainingBudget) ? parseFloat(remainingBudget.toFixed(2)) : 0,
					spentPercentage: Number.isFinite(spentPercentage) ? parseFloat(spentPercentage.toFixed(2)) : 0
				};
			}
		);

		return projects;
	}

	/**
	 * Calculate client budget limit report for a given organization contact.
	 * @param organizationContact The organization contact for which to calculate the budget limit report.
	 * @returns The client budget limit report.
	 */
	async getClientBudgetLimit(request: IGetTimeLogReportInput) {
		const { organizationId, employeeIds = [], projectIds = [], startDate, endDate } = request;
		const tenantId = RequestContext.currentTenantId();

		// Step 1: Create a query builder for the OrganizationClient entity
		const query = this.typeOrmOrganizationContactRepository.createQueryBuilder('organization_contact');

		// Inner join with related entities (employee, timeLogs)
		query.innerJoin(`${query.alias}.timeLogs`, 'timeLogs');
		query.innerJoin(`timeLogs.employee`, 'employee');

		// Set find options for the query
		query.setFindOptions({
			select: {
				id: true,
				name: true,
				budget: true,
				budgetType: true
			},
			relations: {
				timeLogs: {
					employee: true
				}
			}
		});
		query.andWhere(
			new Brackets((qb: WhereExpressionBuilder) => {
				qb.andWhere(p(`"${query.alias}"."organizationId" =:organizationId`), { organizationId });
				qb.andWhere(p(`"${query.alias}"."tenantId" =:tenantId`), { tenantId });
			})
		);
		query.andWhere(
			new Brackets((qb: WhereExpressionBuilder) => {
				qb.andWhere(p(`"employee"."organizationId" =:organizationId`), { organizationId });
				qb.andWhere(p(`"employee"."tenantId" =:tenantId`), { tenantId });

				if (isNotEmpty(employeeIds)) {
					qb.andWhere(p(`"employee"."id" IN (:...employeeIds)`), { employeeIds });
				}
			})
		);
		query.andWhere(
			new Brackets((qb: WhereExpressionBuilder) => {
				qb.andWhere(p(`"timeLogs"."organizationId" =:organizationId`), { organizationId });
				qb.andWhere(p(`"timeLogs"."tenantId" =:tenantId`), { tenantId });

				const { start, end } = getDateRangeFormat(moment.utc(startDate), moment.utc(endDate));
				qb.andWhere(p(`"timeLogs"."startedAt" >= :startDate AND "timeLogs"."startedAt" < :endDate`), {
					startDate: start,
					endDate: end
				});

				if (isNotEmpty(employeeIds)) {
					qb.andWhere(p(`"timeLogs"."employeeId" IN (:...employeeIds)`), {
						employeeIds
					});
				}

				if (isNotEmpty(projectIds)) {
					qb.andWhere(p(`"timeLogs"."projectId" IN (:...projectIds)`), {
						projectIds
					});
				}
			})
		);

		// Execute the query and retrieve organization contacts
		const organizationContacts = await query.getMany();

		const clients = organizationContacts.map(
			(organizationContact: IOrganizationContact): IClientBudgetLimitReport => {
				const { budgetType, timeLogs = [], ...contactWithoutTimeLogs } = organizationContact;
				const budget = organizationContact.budget || 0;

				const spent = timeLogs.reduce((total: number, log: ITimeLog) => {
					const amount =
						budgetType === OrganizationContactBudgetTypeEnum.HOURS
							? total + log.duration / 3600
							: total + (log.duration / 3600) * (log.employee?.billRateValue || 0);
					return amount;
				}, 0);

				const spentPercentage = (spent * 100) / budget;
				const remainingBudget = Math.max(budget - spent, 0);

				return {
					organizationContact: { ...contactWithoutTimeLogs },
					budgetType,
					budget,
					spent: parseFloat(spent.toFixed(2)),
					remainingBudget: Number.isFinite(remainingBudget) ? parseFloat(remainingBudget.toFixed(2)) : 0,
					spentPercentage: Number.isFinite(spentPercentage) ? parseFloat(spentPercentage.toFixed(2)) : 0
				};
			}
		);

		return clients;
	}

	/**
	 * Modifies the provided query to filter TimeLogs based on the given criteria.
	 * @param query - The query to be modified.
	 * @param request - The criteria for filtering TimeLogs.
	 * @param ignoreSlots - Whether to ignore the time slots filter. When time slots are ignored,
	 * 						the activity level filter is also ignored and time slots are not joined.
	 * @returns The modified query.
	 */
	getFilterTimeLogQuery(query: SelectQueryBuilder<TimeLog>, request: IGetTimeLogReportInput, ignoreSlots = false) {
		const { organizationId, projectIds = [], teamIds = [] } = request;
		let { employeeIds = [] } = request;

		const tenantId = RequestContext.currentTenantId();
		const user = RequestContext.currentUser();

		// Check if the current user has the permission to change the selected employee
		const hasChangeSelectedEmployeePermission: boolean = RequestContext.hasPermission(
			PermissionsEnum.CHANGE_SELECTED_EMPLOYEE
		);

		// Determine if the request specifies to retrieve data for the current user only
		const isOnlyMeSelected: boolean = request.onlyMe;

		// Set employeeIds based on permissions and request
		if ((user.employeeId && isOnlyMeSelected) || (!hasChangeSelectedEmployeePermission && user.employeeId)) {
			employeeIds = [user.employeeId];
		}

		// Filters records based on the timesheetId.
		if (isNotEmpty(request.timesheetId)) {
			const { timesheetId } = request;
			query.andWhere(p(`"${query.alias}"."timesheetId" = :timesheetId`), { timesheetId });
		}

		// Filters records based on the date range.
		if (isNotEmpty(request.startDate) && isNotEmpty(request.endDate)) {
			const { start: startDate, end: endDate } = getDateRangeFormat(
				moment.utc(request.startDate || moment().startOf('day')),
				moment.utc(request.endDate || moment().endOf('day'))
			);
			query.andWhere(
				new Brackets((qb) => {
					qb.where(p(`"${query.alias}"."startedAt" >= :startDate`), { startDate });
					qb.andWhere(p(`"${query.alias}"."startedAt" < :endDate`), { endDate });
				})
			);
		}

		// Filter by organization employee IDs if used in the request
		if (isNotEmpty(employeeIds)) {
			query.andWhere(p(`"${query.alias}"."employeeId" IN (:...employeeIds)`), { employeeIds });
		}

		// Filter by organization project IDs if used in the request
		if (isNotEmpty(projectIds)) {
			query.andWhere(p(`"${query.alias}"."projectId" IN (:...projectIds)`), { projectIds });
		}

		// Filter by organization team IDs if used in the request
		if (isNotEmpty(teamIds)) {
			query.andWhere(p(`"${query.alias}"."organizationTeamId" IN (:...teamIds)`), { teamIds });
		}

		// Filters records based on the overall column, representing the activity level.
		if (!ignoreSlots && isNotEmpty(request.activityLevel)) {
			/**
			 * Activity Level should be 0-100%
			 * Convert it into a 10-minute time slot by multiplying by 6
			 */
			const { activityLevel } = request;

			query.andWhere(p(`"timeSlots"."overall" BETWEEN :start AND :end`), {
				start: activityLevel.start * 6,
				end: activityLevel.end * 6
			});
		}

		// Filters records based on the source column.
		if (isNotEmpty(request.source)) {
			const { source } = request;
			const condition =
				source instanceof Array
					? p(`"${query.alias}"."source" IN (:...source)`)
					: p(`"${query.alias}"."source" = :source`);

			query.andWhere(condition, { source });
		}

		// Filters records based on the logType column.
		if (isNotEmpty(request.logType)) {
			const { logType } = request;
			const condition =
				logType instanceof Array
					? p(`"${query.alias}"."logType" IN (:...logType)`)
					: p(`"${query.alias}"."logType" = :logType`);

			query.andWhere(condition, { logType });
		}

		/**
		 * Apply a condition to the TypeORM query based on the 'isEdited' property in the request.
		 * If 'isEdited' is true, filter rows where the 'editedAt' column is not null.
		 * If 'isEdited' is false, filter rows where the 'editedAt' column is null.
		 */
		if ('isEdited' in request) {
			if (request.isEdited) {
				query.andWhere(p(`"${query.alias}"."editedAt" IS NOT NULL`));
			} else {
				query.andWhere(p(`"${query.alias}"."editedAt" IS NULL`));
			}
		}

		query.andWhere(p(`"${query.alias}"."tenantId" = :tenantId`), { tenantId });
		query.andWhere(p(`"${query.alias}"."organizationId" = :organizationId`), { organizationId });
		if (!ignoreSlots) {
			query.andWhere(p(`"timeSlots"."tenantId" = :tenantId`), { tenantId });
			query.andWhere(p(`"timeSlots"."organizationId" = :organizationId`), { organizationId });
		}

		return query;
	}

	/**
	 * Adds a manual time log entry.
	 *
	 * @param request The input data for the manual time log.
	 * @returns The created time log entry.
	 */
	async addManualTime(request: IManualTimeInput): Promise<ITimeLog> {
		try {
			const tenantId = RequestContext.currentTenantId() ?? request.tenantId;
			const { employeeId, startedAt, stoppedAt, organizationId } = request;

			// Validate input
			if (!startedAt || !stoppedAt) {
				throw new BadRequestException('Please select valid Date, start time and end time');
			}

			// Retrieve employee information
			const employee: IEmployee = await this.typeOrmEmployeeRepository.findOne({
				where: { id: employeeId },
				relations: { organization: true }
			});

			// Check if future dates are allowed for the organization
			const futureDateAllowed: IOrganization['futureDateAllowed'] = employee.organization.futureDateAllowed;

			// Check if the selected date and time range is allowed for the organization
			const isDateAllow = this.allowDate(startedAt, stoppedAt, futureDateAllowed);
			if (!isDateAllow) {
				throw new BadRequestException('Please select valid Date, start time and end time');
			}

			// Check for conflicts with existing time logs
			const conflicts = await this.commandBus.execute(
				new IGetConflictTimeLogCommand({
					startDate: startedAt,
					endDate: stoppedAt,
					employeeId,
					organizationId,
					tenantId,
					...(request.id && { ignoreId: request.id }) // Simplified ternary check
				})
			);

			// Resolve conflicts by deleting conflicting time slots
			if (conflicts?.length) {
				const times: IDateRange = {
					start: new Date(startedAt),
					end: new Date(stoppedAt)
				};
				// Loop through each conflicting time log
				for await (const timeLog of conflicts) {
					const { timeSlots = [] } = timeLog;
					// Delete conflicting time slots
					for await (const timeSlot of timeSlots) {
						await this.commandBus.execute(new DeleteTimeSpanCommand(times, timeLog, timeSlot));
					}
				}
			}

			// Create the new time log entry
			const timeLog = await this.commandBus.execute(new TimeLogCreateCommand(request));

			// Generate the activity log
			this.activityLogService.logActivity<TimeLog>(
				BaseEntityEnum.TimeLog,
				ActionTypeEnum.Created,
				ActorTypeEnum.User,
				timeLog.id,
				timeLog.reason,
				timeLog,
				organizationId,
				tenantId
			);

			return timeLog;
		} catch (error) {
			// Handle exceptions appropriately
			this.logger.error('Failed to add manual time log', error);
			throw new BadRequestException('Failed to add manual time log');
		}
	}

	/**
	 * Updates a manual time log entry.
	 *
	 * @param id The ID of the time log entry to be updated.
	 * @param request The updated data for the manual time log.
	 * @returns The updated time log entry.
	 */
	async updateManualTime(id: ID, request: IManualTimeInput): Promise<ITimeLog> {
		try {
			const tenantId = RequestContext.currentTenantId() ?? request.tenantId;
			const { startedAt, stoppedAt, employeeId, organizationId } = request;

			// Validate input
			if (!startedAt || !stoppedAt) {
				throw new BadRequestException('Please select valid Date start and end time');
			}

			// Retrieve employee information
			const employee: IEmployee = await this.typeOrmEmployeeRepository.findOne({
				where: { id: employeeId },
				relations: { organization: true }
			});

			// Check if future dates are allowed for the organization
			const futureDateAllowed: IOrganization['futureDateAllowed'] = employee.organization.futureDateAllowed;

			// Check if the selected date and time range is allowed for the organization
			const isDateAllow = this.allowDate(startedAt, stoppedAt, futureDateAllowed);
			if (!isDateAllow) {
				throw new BadRequestException('Please select valid Date, start time and end time');
			}

			// Check for conflicts with existing time logs
			const timeLog = await this.typeOrmRepository.findOneBy({ id });

			// Check for conflicts with existing time logs
			const conflicts = await this.commandBus.execute(
				new IGetConflictTimeLogCommand({
					startDate: startedAt,
					endDate: stoppedAt,
					employeeId,
					organizationId,
					tenantId,
					...(id && { ignoreId: id }) // Simplified check for id
				})
			);

			// Resolve conflicts by deleting conflicting time slots
			if (conflicts?.length) {
				const times: IDateRange = { start: new Date(startedAt), end: new Date(stoppedAt) };

				// Loop through each conflicting time log
				for await (const timeLog of conflicts) {
					const { timeSlots = [] } = timeLog;
					// Delete conflicting time slots
					for await (const timeSlot of timeSlots) {
						await this.commandBus.execute(new DeleteTimeSpanCommand(times, timeLog, timeSlot));
					}
				}
			}

			// Update the last edited date for the manual time log
			request.editedAt = new Date();

			// Execute the command to update the time log
			await this.commandBus.execute(new TimeLogUpdateCommand(request, timeLog));

			// Retrieve the updated time log entry
			const newTimeLog = await this.typeOrmRepository.findOneBy({ id });

			// Generate the activity log
			this.activityLogService.logActivity<TimeLog>(
				BaseEntityEnum.TimeLog,
				ActionTypeEnum.Updated,
				ActorTypeEnum.User,
				newTimeLog.id,
				newTimeLog.reason,
				newTimeLog,
				organizationId,
				tenantId,
				timeLog,
				request
			);

			return newTimeLog;
		} catch (error) {
			this.logger.error('Failed to update manual time log', error);
			// Handle exceptions appropriately
			throw new BadRequestException('Failed to update manual time log');
		}
	}

	/**
	 * Deletes time logs based on the provided parameters.
	 *
	 * @param params - The parameters for deleting the time logs, including `logIds`, `organizationId`, and `forceDelete`.
	 * @returns A promise that resolves to the result of the delete or soft delete operation.
	 * @throws NotAcceptableException if no log IDs are provided.
	 */
	async deleteTimeLogs(params: IDeleteTimeLog): Promise<DeleteResult | UpdateResult> {
		// Early return if no logIds are provided
		if (isEmpty(params.logIds)) {
			throw new NotAcceptableException('You cannot delete time logs without IDs');
		}

		// Ensure logIds is an array
		const logIds: ID[] = Array.isArray(params.logIds) ? params.logIds : [params.logIds];

		// Get the tenant ID from the request context or the provided tenant ID
		const tenantId = RequestContext.currentTenantId() ?? params.tenantId;
		const { organizationId, forceDelete } = params;

		// Create a query builder for the TimeLog entity
		const query = this.typeOrmRepository.createQueryBuilder();

		// Set find options for the query
		query.setFindOptions({
			relations: { timeSlots: true }
		});

		// Add where clauses to the query
		query.where(p(`"${query.alias}"."id" IN (:...logIds)`), { logIds });
		query.andWhere(p(`"${query.alias}"."tenantId" = :tenantId`), { tenantId });
		query.andWhere(p(`"${query.alias}"."organizationId" = :organizationId`), { organizationId });

		// If user don't have permission to change selected employee, filter by current employee ID
		if (!RequestContext.hasPermission(PermissionsEnum.CHANGE_SELECTED_EMPLOYEE)) {
			const employeeId = RequestContext.currentEmployeeId();
			query.andWhere(p(`"${query.alias}"."employeeId" = :employeeId`), { employeeId });
		}

		// Get the time logs from the database
		const timeLogs = await query.getMany();

		// Invoke the command bus to delete the time logs
		const deleted = await this.commandBus.execute(new TimeLogDeleteCommand(timeLogs, forceDelete));

		// Generate the activity log
		for (const timeLog of timeLogs) {
			this.activityLogService.logActivity<TimeLog>(
				BaseEntityEnum.TimeLog,
				ActionTypeEnum.Deleted,
				ActorTypeEnum.User,
				timeLog.id,
				timeLog.reason,
				timeLog,
				organizationId,
				tenantId
			);
		}

		return deleted;
	}

	/**
	 * Check if the provided date range is allowed.
	 *
	 * @param start - Start date
	 * @param end - End date
	 * @param organization - Organization object
	 * @returns {boolean} - Returns true if the date range is allowed, otherwise false.
	 */
	private allowDate(start: Date, end: Date, futureDateAllowed: boolean): boolean {
		// Check if the start date is before the end date
		if (!moment.utc(start).isBefore(moment.utc(end))) {
			return false;
		}
		// Check if future dates are allowed for the organization
		if (futureDateAllowed) {
			return true;
		}
		// Check if the end date is on or before the current date
		return moment(end).isSameOrBefore(moment());
	}

	private static readonly TASK_SELECT_FIELDS = {
		id: true,
		isActive: true,
		isArchived: true,
		tenantId: true,
		organizationId: true,
		number: true,
		prefix: true,
		title: true,
		description: true,
		status: true,
		priority: true,
		size: true,
		issueType: true,
		estimate: true,
		dueDate: true,
		startDate: true,
		resolvedAt: true,
		version: true,
		taskStatus: {
			name: true,
			value: true,
			description: true,
			icon: true,
			color: true,
			order: true,
			isCollapsed: true,
			isDefault: true
		}
	} as const;
}
