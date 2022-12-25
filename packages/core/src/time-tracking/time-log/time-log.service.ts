import { Injectable, BadRequestException, NotAcceptableException } from '@nestjs/common';
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
	IOrganizationContact,
	ITimeSlot
} from '@gauzy/contracts';
import { CommandBus } from '@nestjs/cqrs';
import { chain, pluck, reduce } from 'underscore';
import { ArraySum, isEmpty, isNotEmpty } from '@gauzy/common';
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

	async getTimeLogs(request: IGetTimeLogInput): Promise<ITimeLog[]> {
		const query = this.timeLogRepository.createQueryBuilder(this.alias);
		query.setFindOptions({
			join: {
				alias: `${this.alias}`,
				innerJoin: {
					employee: `${this.alias}.employee`,
					time_slot: `${this.alias}.timeSlots`
				},
				leftJoin: {
					team_employee: `${this.alias}.employee`,
					organization_teams: 'team_employee.teams'
				}
			},
			select: {
				project: {
					id: true,
					name: true,
					imageUrl: true,
					membersCount: true
				},
				task: {
					id: true,
					title: true
				},
				organizationContact: {
					id: true,
					name: true,
					imageUrl: true
				},
				employee: {
					id: true,
					user: {
						id: true,
						firstName: true,
						lastName: true,
						imageUrl: true
					}
				}
			},
			...(
				(request && request.relations) ? {
					relations: request.relations
				} : {}
			),
			order: {
				startedAt: 'ASC'
			}
		});
		query.where((qb: SelectQueryBuilder<TimeLog>) => {
			this.getFilterTimeLogQuery(qb, request);
		});
		return await query.getMany();
	}

	async getWeeklyReport(request: IGetTimeLogReportInput) {
		/**
		 * GET weekly time logs
		 */
		const query = this.timeLogRepository.createQueryBuilder('time_log');
		query.setFindOptions({
			join: {
				alias: 'time_log',
				innerJoin: {
					employee: 'time_log.employee',
					time_slot: 'time_log.timeSlots'
				}
			},
			select: {
				id: true,
				employeeId: true,
				startedAt: true,
				stoppedAt: true,
				employee: {
					id: true,
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
		query.where((qb: SelectQueryBuilder<TimeLog>) => {
			this.getFilterTimeLogQuery(qb, request);
		});
		const logs = await query.getMany();

		/**
		 * GET weekly time logs reports
		 *
		 */
		const { startDate, endDate } = request;
		const days: Array<string> = getDaysBetweenDates(startDate, endDate);

		const weeklyLogs = chain(logs)
			.groupBy('employeeId')
			.map((logs: ITimeLog[]) => {
				/**
				* calculate avarage weekly duration of the employee.
				*/
				const weeklyDuration = reduce(pluck(logs, 'duration'), ArraySum, 0);
				/**
				* calculate average weekly activity of the employee.
				*/
				const slots: ITimeSlot[] = chain(logs).pluck('timeSlots').flatten(true).value();
				const weeklyActivity = (
					(reduce(pluck(slots, 'overall'), ArraySum, 0) * 100) /
					(reduce(pluck(slots, 'duration'), ArraySum, 0))
				);

				const byDate = chain(logs)
					.groupBy((log: ITimeLog) =>
						moment(log.startedAt).format('YYYY-MM-DD')
					)
					.mapObject((logs: ITimeLog[]) => {
						const sum = logs.reduce((iteratee: any, log: ITimeLog) => {
							return iteratee + log.duration;
						}, 0);
						return { sum, logs: logs };
					})
					.value();

				const employee = logs.length > 0 ? logs[0].employee : null;
				const dates: any = {};
				days.forEach((date) => {
					dates[date] = byDate[date] || 0;
				});
				return {
					employee,
					dates,
					sum: weeklyDuration || null,
					activity: parseFloat(
						parseFloat(weeklyActivity + '').toFixed(2)
					)
				};
			})
			.value();

		return weeklyLogs;
	}

	async getDailyReportChartData(request: IGetTimeLogReportInput) {
		/**
		 * GET daily time logs
		 */
		const query = this.timeLogRepository.createQueryBuilder('time_log');
		query.setFindOptions({
			join: {
				alias: 'time_log',
				innerJoin: {
					employee: 'time_log.employee',
					time_slot: 'time_log.timeSlots'
				}
			},
			order: {
				startedAt: 'ASC'
			}
		});
		query.where((qb: SelectQueryBuilder<TimeLog>) => {
			this.getFilterTimeLogQuery(qb, request);
		});
		const logs = await query.getMany();

		/**
		 * GET daily time logs chart reports
		 *
		 */
		const { startDate, endDate } = request;
		const days: Array<string> = getDaysBetweenDates(startDate, endDate);

		const byDate = chain(logs)
			.groupBy((log) => moment(log.startedAt).format('YYYY-MM-DD'))
			.mapObject((logs: ITimeLog[], date) => {
				const tracked = logs
					.filter((log) => log.logType === TimeLogType.TRACKED)
					.reduce((iteratee: any, log: any) => {
						return iteratee + log.duration;
					}, 0);
				const manual = logs
					.filter((log) => log.logType === TimeLogType.MANUAL)
					.reduce((iteratee: any, log: any) => {
						return iteratee + log.duration;
					}, 0);
				const ideal = logs
					.filter((log) => log.logType === TimeLogType.IDLE)
					.reduce((iteratee: any, log: any) => {
						return iteratee + log.duration;
					}, 0);
				const resumed = logs
					.filter((log) => log.logType === TimeLogType.RESUMED)
					.reduce((iteratee: any, log: any) => {
						return iteratee + log.duration;
					}, 0);
				return {
					date,
					value: {
						[TimeLogType.TRACKED]: parseFloat(
							(tracked / 3600).toFixed(1)
						),
						[TimeLogType.MANUAL]: parseFloat(
							(manual / 3600).toFixed(1)
						),
						[TimeLogType.IDLE]: parseFloat(
							(ideal / 3600).toFixed(1)
						),
						[TimeLogType.RESUMED]: parseFloat(
							(resumed / 3600).toFixed(1)
						)
					}
				};
			})
			.value();

		const dates = days.map((date) => {
			if (byDate[date]) {
				return byDate[date];
			} else {
				return {
					date: date,
					value: {
						[TimeLogType.TRACKED]: 0,
						[TimeLogType.MANUAL]: 0,
						[TimeLogType.IDLE]: 0,
						[TimeLogType.RESUMED]: 0
					}
				};
			}
		});
		return dates;
	}

	async getDailyReport(request: IGetTimeLogReportInput) {
		/**
		 * GET daily time logs report
		 */
		const query = this.timeLogRepository.createQueryBuilder('time_log');
		query.setFindOptions({
			join: {
				alias: 'time_log',
				innerJoin: {
					employee: 'time_log.employee',
					time_slot: 'time_log.timeSlots'
				}
			},
			select: {
				id: true,
				employeeId: true,
				startedAt: true,
				stoppedAt: true,
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
					user: {
						id: true,
						firstName: true,
						lastName: true,
						imageUrl: true
					}
				},
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
				startedAt: 'ASC'
			}
		});
		query.where((qb: SelectQueryBuilder<TimeLog>) => {
			this.getFilterTimeLogQuery(qb, request);
		});
		const logs = await query.getMany();

		/**
		 * GET daily time logs report group by filters
		 */
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

		return dailyLogs;
	}

	async getOwedAmountReport(
		request: IGetTimeLogReportInput
	): Promise<IAmountOwedReport[]> {
		/**
		 * GET Owed amount report time logs
		 *
		 */
		const query = this.timeLogRepository.createQueryBuilder('time_log');
		query.setFindOptions({
			join: {
				alias: 'time_log',
				innerJoin: {
					employee: 'time_log.employee',
					time_slot: 'time_log.timeSlots'
				}
			},
			select: {
				employee: {
					id: true,
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
				startedAt: 'ASC'
			}
		});
		query.where((qb: SelectQueryBuilder<TimeLog>) => {
			this.getFilterTimeLogQuery(qb, request);
		});
		const timeLogs = await query.getMany();

		const dailyLogs: any = chain(timeLogs)
			.groupBy((log) => moment(log.startedAt).format('YYYY-MM-DD'))
			.map((byDateLogs: ITimeLog[], date: string) => {
				const byEmployee = chain(byDateLogs)
					.groupBy('employeeId')
					.map((byEmployeeLogs: ITimeLog[]) => {
						const durationSum = byEmployeeLogs.reduce(
							(iteratee: any, log: any) => {
								return iteratee + log.duration;
							},
							0
						);

						const employee =
							byEmployeeLogs.length > 0
								? byEmployeeLogs[0].employee
								: null;

						const amount =
							employee?.billRateValue * (durationSum / 3600);

						return {
							employee,
							amount: parseFloat(amount.toFixed(1)),
							duration: durationSum
						};
					})
					.value();

				return { date, employees: byEmployee };
			})
			.value();

		return dailyLogs;
	}

	async getOwedAmountReportChartData(request: IGetTimeLogReportInput) {
		const query = this.timeLogRepository.createQueryBuilder('time_log');
		query.setFindOptions({
			join: {
				alias: 'time_log',
				innerJoin: {
					employee: 'time_log.employee',
					time_slot: 'time_log.timeSlots'
				}
			},
			select: {
				employee: {
					id: true,
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
				startedAt: 'ASC'
			}
		});
		query.where((qb: SelectQueryBuilder<TimeLog>) => {
			this.getFilterTimeLogQuery(qb, request);
		});
		const timeLogs = await query.getMany();

		const { startDate, endDate } = request;
		const days: Array<string> = getDaysBetweenDates(startDate, endDate);

		const byDate: any = chain(timeLogs)
			.groupBy((log) => moment(log.startedAt).format('YYYY-MM-DD'))
			.mapObject((byDateLogs: ITimeLog[], date) => {
				const byEmployee = chain(byDateLogs)
					.groupBy('employeeId')
					.map((byEmployeeLogs: ITimeLog[]) => {
						const durationSum = byEmployeeLogs.reduce(
							(iteratee: any, log: any) => {
								return iteratee + log.duration;
							},
							0
						);

						const employee =
							byEmployeeLogs.length > 0
								? byEmployeeLogs[0].employee
								: null;

						const amount =
							employee?.billRateValue * (durationSum / 3600);

						return {
							employee,
							amount: parseFloat(amount.toFixed(1)),
							duration: durationSum
						};
					})
					.value();

				const value = byEmployee.reduce((iteratee: any, obj: any) => {
					return iteratee + obj.amount;
				}, 0);

				return { date, value };
			})
			.value();

		const dates = days.map((date) => {
			if (byDate[date]) {
				return byDate[date];
			} else {
				return {
					date: date,
					value: 0
				};
			}
		});

		return dates;
	}

	async getTimeLimit(request: IGetTimeLimitReportInput) {
		if (!request.duration) {
			request.duration = 'day';
		}

		const query = this.timeLogRepository.createQueryBuilder(this.alias);
		query.setFindOptions({
			join: {
				alias: `${this.alias}`,
				innerJoin: {
					employee: `${this.alias}.employee`,
					time_slot: `${this.alias}.timeSlots`
				}
			},
			select: {
				employee: {
					id: true,
					reWeeklyLimit: true,
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
				startedAt: 'ASC'
			}
		});
		query.where((qb: SelectQueryBuilder<TimeLog>) => {
			this.getFilterTimeLogQuery(qb, request);
		});
		const timeLogs = await query.getMany();

		const { startDate, endDate } = request;
		const days: Array<string> = getDaysBetweenDates(startDate, endDate);

		const byDate: any = chain(timeLogs)
			.groupBy((log) => {
				return moment(log.startedAt)
					.startOf(request.duration)
					.format('YYYY-MM-DD');
			})
			.mapObject((byDateLogs: ITimeLog[], date) => {
				const byEmployee = chain(byDateLogs)
					.groupBy('employeeId')
					.map((byEmployeeLogs: ITimeLog[]) => {
						const durationSum = byEmployeeLogs.reduce(
							(iteratee: any, log: any) => {
								return iteratee + log.duration;
							},
							0
						);

						const employee =
							byEmployeeLogs.length > 0
								? byEmployeeLogs[0].employee
								: null;

						let limit = 0;
						if (employee) {
							limit = employee.reWeeklyLimit * 60 * 60;
						}

						if (request.duration === 'day') {
							limit = limit / 5;
						} else if (request.duration === 'month') {
							limit = limit * 4;
						}

						const durationPercentage = (durationSum * 100) / limit;
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

		const dates = days.map((date) => {
			if (byDate[date]) {
				return byDate[date];
			} else {
				return {
					date: date,
					employees: []
				};
			}
		});

		return dates as ITimeLimitReport[];
	}

	/**
	 * Project budget report
	 *
	 * @param request
	 * @returns
	 */
	async projectBudgetLimit(request: IGetTimeLogReportInput) {
		const { organizationId, employeeIds = [], projectIds = [], startDate, endDate } = request;
		const tenantId = RequestContext.currentTenantId();

		const query = this.organizationProjectRepository.createQueryBuilder('organization_project');
		query.setFindOptions({
			select: {
				id: true,
				name: true,
				budget: true,
				budgetType: true,
				imageUrl: true,
				membersCount: true
			}
		});
		query.innerJoinAndSelect(`${query.alias}.timeLogs`, 'timeLogs');
		query.innerJoinAndSelect(`timeLogs.employee`, 'employee');
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
					qb.andWhere(`"employee"."id" IN (:...employeeIds)`, {
						employeeIds
					});
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

		const organizationProjects = await query.getMany();
		const projects = organizationProjects.map(
			(organizationProject: IOrganizationProject): IProjectBudgetLimitReport => {
				const { budgetType, timeLogs = [] } = organizationProject;
				const budget = organizationProject.budget || 0;

				let spent = 0;
				let spentPercentage = 0;
				let reamingBudget = 0;

				if (budgetType == OrganizationProjectBudgetTypeEnum.HOURS) {
					spent = timeLogs.reduce(
						(iteratee: any, log: ITimeLog) => {
							return iteratee + (log.duration / 3600);
						},
						0
					);
				} else {
					spent = timeLogs.reduce(
						(iteratee: any, log: ITimeLog) => {
							let amount = 0;
							if (log.employee) {
								amount = ((log.duration / 3600) * log.employee.billRateValue);
							}
							return iteratee + amount;
						},
						0
					);
				}

				spentPercentage = (spent * 100) / budget;
				reamingBudget = Math.max(budget - spent, 0);

				delete organizationProject['timeLogs'];
				return {
					project: organizationProject,
					budgetType,
					budget,
					spent: parseFloat(spent.toFixed(2)),
					reamingBudget: Number.isFinite(reamingBudget) ? parseFloat(reamingBudget.toFixed(2)) : 0,
					spentPercentage: Number.isFinite(spentPercentage) ? parseFloat(spentPercentage.toFixed(2)) : 0
				};
			}
		);
		return projects;
	}

	/**
	 * Client budget report
	 *
	 * @param request
	 * @returns
	 */
	async clientBudgetLimit(request: IGetTimeLogReportInput) {
		const { organizationId, employeeIds = [],  projectIds = [], startDate, endDate } = request;
		const tenantId = RequestContext.currentTenantId();

		const query = this.organizationContactRepository.createQueryBuilder('organization_contact');
		query.setFindOptions({
			select: {
				id: true,
				name: true,
				budget: true,
				budgetType: true
			}
		});
		query.innerJoinAndSelect(`${query.alias}.timeLogs`, 'timeLogs');
		query.innerJoinAndSelect(`timeLogs.employee`, 'employee');
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
					qb.andWhere(`"employee"."id" IN (:...employeeIds)`, {
						employeeIds
					});
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

		const organizationContacts = await query.getMany();
		return organizationContacts.map(
			(organizationContact: IOrganizationContact): IClientBudgetLimitReport => {
				const { budgetType, timeLogs = [] } = organizationContact;
				const budget = organizationContact.budget || 0;

				let spent = 0;
				let spentPercentage = 0;
				let reamingBudget = 0;

				if (budgetType == OrganizationContactBudgetTypeEnum.HOURS) {
					spent = timeLogs.reduce(
						(iteratee: any, log: ITimeLog) => {
							return iteratee + (log.duration / 3600);
						},
						0
					);
				} else {
					spent = timeLogs.reduce(
						(iteratee: any, log: ITimeLog) => {
							let amount = 0;
							if (log.employee) {
								amount = ((log.duration / 3600) * log.employee.billRateValue);
							}
							return iteratee + amount;
						},
						0
					);
				}

				spentPercentage = (spent * 100) / budget;
				reamingBudget = Math.max(budget - spent, 0);

				delete organizationContact['timeLogs'];
				return {
					organizationContact,
					budgetType,
					budget,
					spent: parseFloat(spent.toFixed(2)),
					reamingBudget: Number.isFinite(reamingBudget) ? parseFloat(reamingBudget.toFixed(2)) : 0,
					spentPercentage: Number.isFinite(spentPercentage) ? parseFloat(spentPercentage.toFixed(2)) : 0
				};
			}
		);
	}

	getFilterTimeLogQuery(
		query: SelectQueryBuilder<TimeLog>,
		request: IGetTimeLogInput
	) {
		const { organizationId, projectIds = [] } = request;
		const tenantId = RequestContext.currentTenantId();

		let employeeIds: string[];
		if (
			RequestContext.hasPermission(
				PermissionsEnum.CHANGE_SELECTED_EMPLOYEE
			)
		) {
			if (isNotEmpty(request.employeeIds)) {
				employeeIds = request.employeeIds;
			}
		} else {
			const user = RequestContext.currentUser();
			employeeIds = [user.employeeId];
		}
		if (isNotEmpty(request.timesheetId)) {
			const { timesheetId } = request;
			query.andWhere(`"${query.alias}"."timesheetId" = :timesheetId`, {
				timesheetId
			});
		}
		if (isNotEmpty(request.startDate) && isNotEmpty(request.endDate)) {
			const { start: startDate, end: endDate } = getDateRangeFormat(
				moment.utc(request.startDate),
				moment.utc(request.endDate)
			);
			query.andWhere(`"${query.alias}"."startedAt" >= :startDate AND "${query.alias}"."startedAt" < :endDate`, {
				startDate,
				endDate
			});
		}
		if (isNotEmpty(employeeIds)) {
			query.andWhere(`"${query.alias}"."employeeId" IN (:...employeeIds)`, {
				employeeIds
			});
		}
		if (isNotEmpty(projectIds)) {
			query.andWhere(`"${query.alias}"."projectId" IN (:...projectIds)`, {
				projectIds
			});
		}
		if (isNotEmpty(request.activityLevel)) {
			/**
			 * Activity Level should be 0-100%
			 * So, we have convert it into 10 minutes timeslot by multiply by 6
			 */
			const { activityLevel } = request;
			const start = (activityLevel.start * 6);
			const end = (activityLevel.end * 6);

			query.andWhere(`"time_slot"."overall" BETWEEN :start AND :end`, {
				start,
				end
			});
		}
		if (isNotEmpty(request.source)) {
			const { source } = request;
			if (source instanceof Array) {
				query.andWhere(`"${query.alias}"."source" IN (:...source)`, {
					source
				});
			} else {
				query.andWhere(`"${query.alias}"."source" = :source`, {
					source
				});
			}
		}
		if (isNotEmpty(request.logType)) {
			const { logType } = request;
			if (logType instanceof Array) {
				query.andWhere(`"${query.alias}"."logType" IN (:...logType)`, {
					logType
				});
			} else {
				query.andWhere(`"${query.alias}"."logType" = :logType`, {
					logType
				});
			}
		}
		if (isNotEmpty(request.teamId)) {
			const { teamId } = request;
			/**
			 * If used organization team filter
			 */
			query.andWhere(`"organization_teams"."organizationTeamId" = :teamId`, {
				teamId
			});
		}
		query.andWhere(
			new Brackets((qb: WhereExpressionBuilder) => {
				qb.andWhere(`"${query.alias}"."tenantId" = :tenantId`, { tenantId });
				qb.andWhere(`"${query.alias}"."organizationId" = :organizationId`, { organizationId });
				qb.andWhere(`"${query.alias}"."deletedAt" IS NULL`);
			})
		);
		return query;
	}

	async addManualTime(request: IManualTimeInput): Promise<TimeLog> {
		const tenantId = RequestContext.currentTenantId();
		const { employeeId, startedAt, stoppedAt, organizationId } = request;

		if (!startedAt || !stoppedAt) {
			throw new BadRequestException(
				'Please select valid Date, start time and end time'
			);
		}

		/**
		 * Get Employee
		 */
		const employee = await this.employeeRepository.findOne({
			where: {
				id: employeeId
			},
			relations: {
				organization: true
			}
		});
		const isDateAllow = this.allowDate(
			startedAt,
			stoppedAt,
			employee.organization
		);

		if (!isDateAllow) {
			throw new BadRequestException(
				'Please select valid Date, start time and end time'
			);
		}

		const conflicts = await this.checkConflictTime({
			startDate: startedAt,
			endDate: stoppedAt,
			employeeId,
			organizationId,
			tenantId,
			...(request.id ? { ignoreId: request.id } : {})
		});

		if (isNotEmpty(conflicts)) {
			const times: IDateRange = {
				start: new Date(startedAt),
				end: new Date(stoppedAt)
			};
			for await (const timeLog of conflicts)  {
				const { timeSlots = [] } = timeLog;
				for await (const timeSlot of timeSlots) {
					await this.commandBus.execute(
						new DeleteTimeSpanCommand(
							times,
							timeLog,
							timeSlot
						)
					);
				}
			}
		}
		return await this.commandBus.execute(
			new TimeLogCreateCommand(request)
		);
	}

	async updateManualTime(id: string, request: IManualTimeInput): Promise<TimeLog> {
		const tenantId = RequestContext.currentTenantId();
		const { startedAt, stoppedAt, employeeId, organizationId } = request;

		if (!startedAt || !stoppedAt) {
			throw new BadRequestException('Please select valid Date start and end time');
		}

		/**
		 * Get Employee
		 */
		const employee = await this.employeeRepository.findOne({
			where: {
				id: employeeId
			},
			relations: {
				organization: true
			}
		});
		/**
		 * Check future date allow
		 */
		const isDateAllow = this.allowDate(
			startedAt,
			stoppedAt,
			employee.organization
		);
		if (!isDateAllow) {
			throw new BadRequestException('Please select valid Date start and end time');
		}

		/**
		 * Check Conflicts TimeLogs
		 */
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
		if (isNotEmpty(conflicts)) {
			const times: IDateRange = {
				start: new Date(startedAt),
				end: new Date(stoppedAt)
			};
			for await (const timeLog of conflicts)  {
				const { timeSlots = [] } = timeLog;
				for await (const timeSlot of timeSlots) {
					await this.commandBus.execute(
						new DeleteTimeSpanCommand(
							times,
							timeLog,
							timeSlot
						)
					);
				}
			}
		}

		await this.commandBus.execute(
			new TimeLogUpdateCommand(request, timeLog)
		);

		return await this.timeLogRepository.findOneBy({
			id: request.id
		});
	}

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
				...(
					RequestContext.hasPermission(
						PermissionsEnum.CHANGE_SELECTED_EMPLOYEE
					) ? {} : {
						employeeId: user.employeeId
					}
				)
			});
			db.andWhere(
				new Brackets((web: WhereExpressionBuilder) => {
					web.andWhere(`"${db.alias}"."tenantId" = :tenantId`, { tenantId });
					web.andWhere(`"${db.alias}"."organizationId" = :organizationId`, { organizationId });
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

	async checkConflictTime(request: IGetTimeLogConflictInput): Promise<ITimeLog[]> {
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
