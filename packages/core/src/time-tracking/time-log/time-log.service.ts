import {
	Injectable,
	BadRequestException,
	NotAcceptableException
} from '@nestjs/common';
import { TimeLog } from './time-log.entity';
import { InjectRepository } from '@nestjs/typeorm';
import {
	Repository,
	SelectQueryBuilder,
	Brackets,
	WhereExpressionBuilder,
	DeleteResult,
	UpdateResult
} from 'typeorm';
import { RequestContext } from '../../core/context';
import {
	IManualTimeInput,
	IGetTimeLogInput,
	PermissionsEnum,
	IGetTimeLogConflictInput,
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
	IOrganizationContact
} from '@gauzy/contracts';
import { CommandBus } from '@nestjs/cqrs';
import { chain, pluck } from 'underscore';
import { isEmpty, isNotEmpty } from '@gauzy/common';
import { TenantAwareCrudService } from './../../core/crud';
import {
	Employee,
	Organization,
	OrganizationContact,
	OrganizationProject
} from '../../core/entities/internal';
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
import { moment } from './../../core/moment-extend';
import { calculateAverage, calculateAverageActivity, calculateDuration } from './time-log.utils';

@Injectable()
export class TimeLogService extends TenantAwareCrudService<TimeLog> {
	constructor(
		private readonly commandBus: CommandBus,

		@InjectRepository(TimeLog)
		private readonly timeLogRepository: Repository<TimeLog>,

		@InjectRepository(Employee)
		private readonly employeeRepository: Repository<Employee>,

		@InjectRepository(OrganizationProject)
		private readonly organizationProjectRepository: Repository<OrganizationProject>,

		@InjectRepository(OrganizationContact)
		private readonly organizationContactRepository: Repository<OrganizationContact>
	) {
		super(timeLogRepository);
	}

	/**
	 * Retrieves time logs based on the provided input.
	 * @param request The input parameters for fetching time logs.
	 * @returns A Promise that resolves to an array of time logs.
	 */
	async getTimeLogs(request: IGetTimeLogInput): Promise<ITimeLog[]> {
		// Create a query builder for the TimeLog entity
		const query = this.timeLogRepository.createQueryBuilder(this.alias);

		// Inner join with related entities (employee, timeSlots)
		query.innerJoin(`${query.alias}.employee`, 'employee');
		query.innerJoin(`${query.alias}.timeSlots`, 'time_slot');

		// Set up the find options for the query
		query.setFindOptions({
			select: {
				project: {
					id: true,
					name: true,
					imageUrl: true,
					membersCount: true
				},
				task: {
					id: true,
					title: true,
					estimate: true
				},
				organizationContact: {
					id: true,
					name: true,
					imageUrl: true
				},
				employee: {
					id: true,
					userId: true,
					user: {
						id: true,
						firstName: true,
						lastName: true,
						imageUrl: true
					}
				}
			},
			relations: [
				...(request.relations ? request.relations : [])
			],
			order: {
				startedAt: 'ASC'
			}
		});

		// Set up the where clause using the provided filter function
		query.where((qb: SelectQueryBuilder<TimeLog>) => {
			this.getFilterTimeLogQuery(qb, request);
		});

		// Set up the where clause using the provided filter function
		return await query.getMany();
	}

	/**
	 * Fetches time logs for a weekly report based on the provided input.
	 * @param request The input parameters for fetching time logs.
	 * @returns A Promise that resolves to an array of weekly report data.
	 */
	async getWeeklyReport(request: IGetTimeLogReportInput) {
		// Create a query builder for the TimeLog entity
		const query = this.timeLogRepository.createQueryBuilder('time_log');

		// Inner join with related entities (employee, timeSlots)
		query.innerJoin(`${query.alias}.employee`, 'employee');
		query.innerJoin(`${query.alias}.timeSlots`, 'time_slot');

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
					user: {
						id: true,
						firstName: true,
						lastName: true,
						imageUrl: true
					}
				},
				timeSlots: {
					id: true,
					overall: true,
					duration: true
				}
			},
			relations: {
				timeSlots: true,
				employee: {
					user: true
				}
			},
			order: {
				startedAt: 'ASC'
			}
		});
		// Apply additional conditions to the query based on request filters
		query.where((qb: SelectQueryBuilder<TimeLog>) => {
			this.getFilterTimeLogQuery(qb, request);
		});

		// Execute the query and retrieve time logs
		const logs = await query.getMany();

		// Gets an array of days between the given start and end dates.
		const { startDate, endDate } = request;
		const days: Array<string> = getDaysBetweenDates(startDate, endDate);

		// Process weekly logs using lodash and Moment.js
		const weeklyLogs = chain(logs).groupBy('employeeId').map((logs: ITimeLog[]) => {
			// Calculate average duration for specific employee.
			const weeklyDuration = calculateAverage(pluck(logs, 'duration'));

			// Calculate average weekly activity for specific employee.
			const weeklyActivity = calculateAverageActivity(chain(logs).pluck('timeSlots').flatten(true).value());

			const byDate = chain(logs)
				.groupBy((log: ITimeLog) => moment.utc(log.startedAt).format('YYYY-MM-DD'))
				.mapObject((logs: ITimeLog[]) => {
					// Calculate average duration of the employee for specific date range.
					const sum = calculateAverage(pluck(logs, 'duration'));
					return { sum, logs };
				})
				.value();

			// Retrieve employee details
			const employee = logs.length > 0 ? logs[0].employee : null;

			const dates: Record<string, any> = {};
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
		}).value();

		return weeklyLogs;
	}

	/**
	 * Fetches daily time logs for chart reports based on the provided input.
	 * @param request The input parameters for fetching daily time logs.
	 * @returns An array of daily time log chart reports.
	 */
	async getDailyReportCharts(request: IGetTimeLogReportInput) {
		// Create a query builder for the TimeLog entity
		const query = this.timeLogRepository.createQueryBuilder('time_log');

		// Inner join with related entities (employee, timeSlots)
		query.innerJoin(`${query.alias}.employee`, 'employee');
		query.innerJoin(`${query.alias}.timeSlots`, 'time_slot');

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

		// Gets an array of days between the given start and end dates.
		const { startDate, endDate } = request;
		const days: Array<string> = getDaysBetweenDates(startDate, endDate);

		// Group time logs by date and calculate tracked, manual, idle, and resumed durations
		const byDate = chain(logs)
			.groupBy((log) => moment.utc(log.startedAt).format('YYYY-MM-DD'))
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
			}).value();


		// Map the calculated values to each date, ensuring no missing dates
		const dates = days.map((date) => {
			return byDate[date] || {
				date,
				value: {
					[TimeLogType.TRACKED]: 0,
					[TimeLogType.MANUAL]: 0,
					[TimeLogType.IDLE]: 0,
					[TimeLogType.RESUMED]: 0
				}
			};
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
		// Create a query builder for the TimeLog entity
		const query = this.timeLogRepository.createQueryBuilder('time_log');

		// Inner join with related entities (employee, timeSlots)
		query.innerJoin(`${query.alias}.employee`, 'employee');
		query.innerJoin(`${query.alias}.timeSlots`, 'time_slot');

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
				task: {
					id: true,
					title: true
				},
				timeSlots: {
					id: true,
					overall: true,
					duration: true
				},
				organizationContact: {
					id: true,
					name: true,
					imageUrl: true
				},
				employee: {
					id: true,
					userId: true,
					user: {
						id: true,
						firstName: true,
						lastName: true,
						imageUrl: true
					}
				}
			},
			relations: {
				project: {
					organizationContact: true
				},
				task: true,
				timeSlots: true,
				organizationContact: true,
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
		const logs = await query.getMany();

		// Group time logs based on the specified 'groupBy' filter
		let dailyLogs;
		switch (request.groupBy) {
			case ReportGroupFilterEnum.employee:
				dailyLogs = await this.commandBus.execute(
					new GetTimeLogGroupByEmployeeCommand(logs)
				);
				break;
			case ReportGroupFilterEnum.project:
				dailyLogs = await this.commandBus.execute(
					new GetTimeLogGroupByProjectCommand(logs)
				);
				break;
			case ReportGroupFilterEnum.client:
				dailyLogs = await this.commandBus.execute(
					new GetTimeLogGroupByClientCommand(logs)
				);
				break;
			default:
				dailyLogs = await this.commandBus.execute(
					new GetTimeLogGroupByDateCommand(logs)
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
		// Create a query builder for the TimeLog entity
		const query = this.timeLogRepository.createQueryBuilder('time_log');

		// Inner join with related entities (employee, timeSlots)
		query.innerJoin(`${query.alias}.employee`, 'employee');
		query.innerJoin(`${query.alias}.timeSlots`, 'time_slot');

		// Set up the find options for the query
		query.setFindOptions({
			select: {
				employee: {
					id: true,
					userId: true,
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

		const dailyLogs: any = chain(timeLogs)
			.groupBy((log) => moment.utc(log.startedAt).format('YYYY-MM-DD'))
			.map((byDateLogs: ITimeLog[], date: string) => {
				const byEmployee = chain(byDateLogs).groupBy('employeeId').map((byEmployeeLogs: ITimeLog[]) => {
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
				}).value();

				return {
					date,
					employees: byEmployee
				};
			}).value();

		return dailyLogs;
	}

	/**
	 * Fetches owed amount report data for charts based on the provided input.
	 * @param request The input parameters for fetching owed amount report charts.
	 * @returns An array of owed amount report chart data.
	 */
	async getOwedAmountReportCharts(request: IGetTimeLogReportInput) {
		// Step 1: Create a query builder for the TimeLog entity
		const query = this.timeLogRepository.createQueryBuilder('time_log');

		// Inner join with related entities (employee, timeSlots)
		query.innerJoin(`${query.alias}.employee`, 'employee');
		query.innerJoin(`${query.alias}.timeSlots`, 'time_slot');

		// Set find options for the query
		query.setFindOptions({
			select: {
				// Selected fields for the result
				employee: {
					id: true,
					billRateValue: true,
					userId: true,
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

		// Gets an array of days between the given start and end dates.
		const { startDate, endDate } = request;
		const days: Array<string> = getDaysBetweenDates(startDate, endDate);

		const byDate: any = chain(timeLogs)
			.groupBy((log) => moment(log.startedAt).format('YYYY-MM-DD'))
			.mapObject((byDateLogs: ITimeLog[], date) => {
				const byEmployee = chain(byDateLogs).groupBy('employeeId').map((byEmployeeLogs: ITimeLog[]) => {
					// Calculate average duration for specific employee.
					const durationSum = calculateAverage(pluck(byEmployeeLogs, 'duration'));

					// Retrieve employee details
					const employee = byEmployeeLogs.length > 0 ? byEmployeeLogs[0].employee : null;

					// Calculate the owed amount based on the employee's bill rate and dura
					const amount = employee?.billRateValue * (durationSum / 3600);

					return {
						employee,
						amount: parseFloat(amount.toFixed(1)),
						duration: durationSum
					};
				}).value();

				// Calculate the total owed amount for all employees on a specific date
				const value = byEmployee.reduce((iteratee: any, obj: any) => {
					return iteratee + obj.amount;
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
		const query = this.timeLogRepository.createQueryBuilder(this.alias);

		// Inner join with related entities (employee, timeSlots)
		query.innerJoin(`${query.alias}.employee`, 'employee');
		query.innerJoin(`${query.alias}.timeSlots`, 'time_slot');

		// Set find options for the query
		query.setFindOptions({
			select: {
				// Specify the fields to be selected in the query result.
				employee: {
					id: true,
					reWeeklyLimit: true,
					userId: true,
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

		// Gets an array of days between the given start and end dates.
		const { startDate, endDate } = request;
		const days: Array<string> = getDaysBetweenDates(startDate, endDate);

		// Process time log data and calculate time limits for each employee and date
		const byDate: any = chain(timeLogs)
			.groupBy((log) => moment(log.startedAt).startOf(request.duration).format('YYYY-MM-DD'))
			.mapObject((byDateLogs: ITimeLog[], date) => {
				const byEmployee = chain(byDateLogs).groupBy('employeeId').map((byEmployeeLogs: ITimeLog[]) => {
					// Calculate average duration for specific employee.
					const durationSum = calculateAverage(pluck(byEmployeeLogs, 'duration'));

					// Retrieve employee details
					const employee = byEmployeeLogs.length > 0 ? byEmployeeLogs[0].employee : null;

					let limit = employee ? employee.reWeeklyLimit * 60 * 60 : 0;

					// Define a mapping object for duration multipliers
					const multipliers = {
						'day': 1 / 5,
						'month': 4
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
				}).value();

				return { date, employees: byEmployee };
			})
			.value();

		// Create an array of ITimeLimitReport for each date.
		const dates = days.map((date) => byDate[date] ? byDate[date] : { date, employees: [] });

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
		const query = this.organizationProjectRepository.createQueryBuilder('organization_project');

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
				qb.andWhere(`"${query.alias}"."organizationId" =:organizationId`, {
					organizationId
				});
				qb.andWhere(`"${query.alias}"."tenantId" =:tenantId`, {
					tenantId
				});
			})
		);
		query.andWhere(
			new Brackets((qb: WhereExpressionBuilder) => {
				qb.andWhere(`"employee"."organizationId" =:organizationId`, {
					organizationId
				});
				qb.andWhere(`"employee"."tenantId" =:tenantId`, {
					tenantId
				});
				if (isNotEmpty(employeeIds)) {
					qb.andWhere(`"employee"."id" IN (:...employeeIds)`, {
						employeeIds
					});
				}
			})
		);
		query.andWhere(
			new Brackets((qb: WhereExpressionBuilder) => {
				qb.andWhere(`"timeLogs"."organizationId" =:organizationId`, {
					organizationId
				});
				qb.andWhere(`"timeLogs"."tenantId" =:tenantId`, { tenantId });

				// Date range condition
				const { start, end } = getDateRangeFormat(
					moment.utc(startDate),
					moment.utc(endDate)
				);
				qb.andWhere(`"timeLogs"."startedAt" >= :startDate AND "timeLogs"."startedAt" < :endDate`, {
					startDate: start,
					endDate: end
				});

				if (isNotEmpty(employeeIds)) {
					qb.andWhere(`"timeLogs"."employeeId" IN (:...employeeIds)`, {
						employeeIds
					});
				}
				if (isNotEmpty(projectIds)) {
					qb.andWhere(`"timeLogs"."projectId" IN (:...projectIds)`, {
						projectIds
					});
				}
			})
		);

		// Execute the query and retrieve organization projects
		const organizationProjects = await query.getMany();

		const projects = organizationProjects.map((organizationProject: IOrganizationProject): IProjectBudgetLimitReport => {
			const { budgetType, timeLogs = [] } = organizationProject;
			const budget = organizationProject.budget || 0;

			let spent = 0;
			let spentPercentage = 0;
			let remainingBudget = 0;

			if (budgetType == OrganizationProjectBudgetTypeEnum.HOURS) {
				spent = timeLogs.reduce((totalDuration: number, log: ITimeLog) => totalDuration + log.duration / 3600, 0);
			} else {
				spent = timeLogs.reduce((totalAmount: number, log: ITimeLog) => {
					const logAmount = log.employee ? (log.duration / 3600) * log.employee.billRateValue : 0;
					return totalAmount + logAmount;
				}, 0);
			}

			spentPercentage = (spent * 100) / budget;
			remainingBudget = Math.max(budget - spent, 0);

			// Remove timeLogs property from the organizationProject object
			const { timeLogs: _, ...projectWithoutTimeLogs } = organizationProject;

			return {
				project: projectWithoutTimeLogs,
				budgetType,
				budget,
				spent: parseFloat(spent.toFixed(2)),
				remainingBudget: Number.isFinite(remainingBudget) ? parseFloat(remainingBudget.toFixed(2)) : 0,
				spentPercentage: Number.isFinite(spentPercentage) ? parseFloat(spentPercentage.toFixed(2)) : 0,
			};
		});

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
		const query = this.organizationContactRepository.createQueryBuilder('organization_contact');

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
				qb.andWhere(`"${query.alias}"."organizationId" =:organizationId`, { organizationId });
				qb.andWhere(`"${query.alias}"."tenantId" =:tenantId`, { tenantId });
			})
		);
		query.andWhere(
			new Brackets((qb: WhereExpressionBuilder) => {
				qb.andWhere(`"employee"."organizationId" =:organizationId`, { organizationId });
				qb.andWhere(`"employee"."tenantId" =:tenantId`, { tenantId });

				if (isNotEmpty(employeeIds)) {
					qb.andWhere(`"employee"."id" IN (:...employeeIds)`, { employeeIds });
				}
			})
		);
		query.andWhere(
			new Brackets((qb: WhereExpressionBuilder) => {
				qb.andWhere(`"timeLogs"."organizationId" =:organizationId`, { organizationId });
				qb.andWhere(`"timeLogs"."tenantId" =:tenantId`, { tenantId });

				const { start, end } = getDateRangeFormat(
					moment.utc(startDate),
					moment.utc(endDate)
				);
				qb.andWhere(`"timeLogs"."startedAt" >= :startDate AND "timeLogs"."startedAt" < :endDate`, {
					startDate: start,
					endDate: end
				});

				if (isNotEmpty(employeeIds)) {
					qb.andWhere(`"timeLogs"."employeeId" IN (:...employeeIds)`, {
						employeeIds
					});
				}

				if (isNotEmpty(projectIds)) {
					qb.andWhere(`"timeLogs"."projectId" IN (:...projectIds)`, {
						projectIds
					});
				}
			})
		);

		// Execute the query and retrieve organization contacts
		const organizationContacts = await query.getMany();

		const clients = organizationContacts.map((organizationContact: IOrganizationContact): IClientBudgetLimitReport => {
			const { budgetType, timeLogs = [], ...contactWithoutTimeLogs } = organizationContact;
			const budget = organizationContact.budget || 0;

			const spent = timeLogs.reduce((total: number, log: ITimeLog) => {
				const amount = (budgetType === OrganizationContactBudgetTypeEnum.HOURS) ? total + log.duration / 3600 : total + ((log.duration / 3600) * (log.employee?.billRateValue || 0));
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
				spentPercentage: Number.isFinite(spentPercentage) ? parseFloat(spentPercentage.toFixed(2)) : 0,
			};
		});

		return clients;
	}

	/**
	 * Modifies the provided query to filter TimeLogs based on the given criteria.
	 * @param query - The query to be modified.
	 * @param request - The criteria for filtering TimeLogs.
	 * @returns The modified query.
	 */
	getFilterTimeLogQuery(query: SelectQueryBuilder<TimeLog>, request: IGetTimeLogInput) {
		const { organizationId, projectIds = [], teamIds = [] } = request;
		const tenantId = RequestContext.currentTenantId();
		const user = RequestContext.currentUser();

		// Check if the current user has the permission to change the selected employee
		const hasChangeSelectedEmployeePermission: boolean = RequestContext.hasPermission(
			PermissionsEnum.CHANGE_SELECTED_EMPLOYEE
		);

		// Set employeeIds based on permissions and request
		const employeeIds: string[] = hasChangeSelectedEmployeePermission && isNotEmpty(request.employeeIds) ? request.employeeIds : [user.employeeId];

		if (isNotEmpty(request.timesheetId)) {
			query.andWhere(`"${query.alias}"."timesheetId" = :timesheetId`, {
				timesheetId: request.timesheetId
			});
		}

		//
		if (isNotEmpty(request.startDate) && isNotEmpty(request.endDate)) {
			const { start: startDate, end: endDate } = getDateRangeFormat(
				moment.utc(request.startDate || moment().startOf('day')),
				moment.utc(request.endDate || moment().endOf('day'))
			);
			query.andWhere(`"${query.alias}"."startedAt" >= :startDate AND "${query.alias}"."startedAt" < :endDate`, {
				startDate,
				endDate
			});
		}

		//
		if (isNotEmpty(employeeIds)) {
			query.andWhere(`"${query.alias}"."employeeId" IN (:...employeeIds)`, {
				employeeIds
			});
		}

		//
		if (isNotEmpty(projectIds)) {
			query.andWhere(`"${query.alias}"."projectId" IN (:...projectIds)`, {
				projectIds
			});
		}

		// Filter by organization team ID if used in the request
		if (isNotEmpty(teamIds)) {
			query.andWhere(`"${query.alias}"."organizationTeamId" IN (:...teamIds)`, {
				teamIds
			});
		}

		// Filters records based on the overall column, representing the activity level.
		if (isNotEmpty(request.activityLevel)) {
			/**
			 * Activity Level should be 0-100%
			 * Convert it into a 10-minute time slot by multiplying by 6
			 */
			const { activityLevel } = request;

			query.andWhere(`"time_slot"."overall" BETWEEN :start AND :end`, {
				start: activityLevel.start * 6,
				end: activityLevel.end * 6
			});
		}

		// Filters records based on the source column.
		if (isNotEmpty(request.source)) {
			const { source } = request;
			const condition = source instanceof Array ? `"${query.alias}"."source" IN (:...source)` : `"${query.alias}"."source" = :source`;

			query.andWhere(condition, { source });
		}

		// Filters records based on the logType column.
		if (isNotEmpty(request.logType)) {
			const { logType } = request;
			const condition = logType instanceof Array ? `"${query.alias}"."logType" IN (:...logType)` : `"${query.alias}"."logType" = :logType`;

			query.andWhere(condition, { logType });
		}

		// Additional conditions for filtering by tenantId and organizationId
		query.andWhere(
			new Brackets((qb: WhereExpressionBuilder) => {
				qb.andWhere(`"${query.alias}"."tenantId" = :tenantId`, {
					tenantId
				});
				qb.andWhere(`"${query.alias}"."organizationId" = :organizationId`, {
					organizationId
				});
			})
		);

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
			const tenantId = RequestContext.currentTenantId();
			const { employeeId, startedAt, stoppedAt, organizationId } = request;

			// Validate input
			if (!startedAt || !stoppedAt) {
				throw new BadRequestException('Please select valid Date, start time and end time');
			}

			// Retrieve employee information
			const employee = await this.employeeRepository.findOne({
				where: { id: employeeId },
				relations: { organization: true }
			});

			// Check if the selected date and time range is allowed for the organization
			const isDateAllow = this.allowDate(startedAt, stoppedAt, employee.organization);

			if (!isDateAllow) {
				throw new BadRequestException('Please select valid Date, start time and end time');
			}

			// Check for conflicts with existing time logs
			const conflicts = await this.checkConflictTime({
				startDate: startedAt,
				endDate: stoppedAt,
				employeeId,
				organizationId,
				tenantId,
				...(request.id ? { ignoreId: request.id } : {})
			});

			// Resolve conflicts by deleting conflicting time slots
			if (conflicts && conflicts.length > 0) {
				const times: IDateRange = {
					start: new Date(startedAt),
					end: new Date(stoppedAt)
				};
				for await (const timeLog of conflicts) {
					const { timeSlots = [] } = timeLog;
					for await (const timeSlot of timeSlots) {
						await this.commandBus.execute(
							new DeleteTimeSpanCommand(times, timeLog, timeSlot)
						);
					}
				}
			}

			// Create the new time log entry
			return await this.commandBus.execute(
				new TimeLogCreateCommand(request)
			);
		} catch (error) {
			// Handle exceptions appropriately
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
	async updateManualTime(
		id: ITimeLog['id'],
		request: IManualTimeInput
	): Promise<ITimeLog> {
		try {
			const tenantId = RequestContext.currentTenantId();
			const { startedAt, stoppedAt, employeeId, organizationId } = request;

			// Validate input
			if (!startedAt || !stoppedAt) {
				throw new BadRequestException('Please select valid Date start and end time');
			}

			// Retrieve employee information
			const employee = await this.employeeRepository.findOne({
				where: { id: employeeId },
				relations: { organization: true }
			});

			// Check if the selected date and time range is allowed for the organization
			const isDateAllow = this.allowDate(startedAt, stoppedAt, employee.organization);

			if (!isDateAllow) {
				throw new BadRequestException('Please select valid Date start and end time');
			}

			// Check for conflicts with existing time logs
			const timeLog = await this.timeLogRepository.findOneBy({
				id: id
			});

			const conflicts = await this.checkConflictTime({
				startDate: startedAt,
				endDate: stoppedAt,
				employeeId,
				organizationId,
				tenantId,
				...(id ? { ignoreId: id } : {})
			});

			// Resolve conflicts by deleting conflicting time slots
			if (isNotEmpty(conflicts)) {
				const times: IDateRange = {
					start: new Date(startedAt),
					end: new Date(stoppedAt)
				};
				for await (const timeLog of conflicts) {
					const { timeSlots = [] } = timeLog;
					for await (const timeSlot of timeSlots) {
						await this.commandBus.execute(
							new DeleteTimeSpanCommand(times, timeLog, timeSlot)
						);
					}
				}
			}

			// Update the last edited date for the manual time log
			request.editedAt = new Date();

			// Execute the command to update the time log
			await this.commandBus.execute(
				new TimeLogUpdateCommand(request, timeLog)
			);

			// Retrieve the updated time log entry
			return await this.timeLogRepository.findOneBy({ id: request.id });
		} catch (error) {
			// Handle exceptions appropriately
			throw new BadRequestException('Failed to update manual time log');
		}
	}

	/**
	 *
	 * @param params
	 * @returns
	 */
	async deleteTimeLogs(
		params: IDeleteTimeLog
	): Promise<DeleteResult | UpdateResult> {
		let logIds: string | string[] = params.logIds;
		if (isEmpty(logIds)) {
			throw new NotAcceptableException('You can not delete time logs');
		}
		if (typeof logIds === 'string') {
			logIds = [logIds];
		}

		const tenantId = RequestContext.currentTenantId();
		const user = RequestContext.currentUser();
		const { organizationId, forceDelete } = params;

		const query = this.timeLogRepository.createQueryBuilder('time_log');
		query.setFindOptions({
			relations: {
				timeSlots: true
			}
		});
		query.where((db: SelectQueryBuilder<TimeLog>) => {
			db.andWhere({
				...(RequestContext.hasPermission(
					PermissionsEnum.CHANGE_SELECTED_EMPLOYEE
				)
					? {}
					: {
						employeeId: user.employeeId
					})
			});
			db.andWhere(
				new Brackets((web: WhereExpressionBuilder) => {
					web.andWhere(`"${db.alias}"."tenantId" = :tenantId`, {
						tenantId
					});
					web.andWhere(
						`"${db.alias}"."organizationId" = :organizationId`,
						{ organizationId }
					);
					web.andWhere(`"${db.alias}"."id" IN (:...logIds)`, {
						logIds
					});
				})
			);
		});

		const timeLogs = await query.getMany();
		return await this.commandBus.execute(
			new TimeLogDeleteCommand(timeLogs, forceDelete)
		);
	}

	async checkConflictTime(
		request: IGetTimeLogConflictInput
	): Promise<ITimeLog[]> {
		return await this.commandBus.execute(
			new IGetConflictTimeLogCommand(request)
		);
	}

	private allowDate(start: Date, end: Date, organization: Organization) {
		if (!moment.utc(start).isBefore(moment.utc(end))) {
			return false;
		}
		if (organization.futureDateAllowed) {
			return true;
		}
		return moment(end).isSameOrBefore(moment());
	}
}
