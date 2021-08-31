import { Injectable, BadRequestException } from '@nestjs/common';
import { TimeLog } from './time-log.entity';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In, SelectQueryBuilder, Brackets, WhereExpression } from 'typeorm';
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
	IProjectBudgetLimitReportInput,
	IClientBudgetLimitReportInput,
	OrganizationContactBudgetTypeEnum,
	IClientBudgetLimitReport,
	ReportGroupFilterEnum,
	IOrganizationProject
} from '@gauzy/contracts';
import * as moment from 'moment';
import { CommandBus } from '@nestjs/cqrs';
import * as _ from 'underscore';
import { chain } from 'underscore';
import { ConfigService } from '@gauzy/config';
import { TenantAwareCrudService } from './../../core/crud';
import {
	Employee,
	Organization,
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


@Injectable()
export class TimeLogService extends TenantAwareCrudService<TimeLog> {
	constructor(
		private commandBus: CommandBus,

		@InjectRepository(TimeLog)
		private readonly timeLogRepository: Repository<TimeLog>,

		@InjectRepository(Employee)
		private readonly employeeRepository: Repository<Employee>,

		@InjectRepository(OrganizationProject)
		private readonly organizationProjectRepository: Repository<OrganizationProject>,

		private readonly configService: ConfigService
	) {
		super(timeLogRepository);
	}

	async getTimeLogs(request: IGetTimeLogInput): Promise<ITimeLog[]> {
		return await this.timeLogRepository.find({
			join: {
				alias: 'timeLogs',
				innerJoin: {
					employee: 'timeLogs.employee',
					timeSlots: 'timeLogs.timeSlots'
				}
			},
			relations: [
				'project',
				'task',
				'organizationContact',
				'timeSlots',
				...(RequestContext.hasPermission(
					PermissionsEnum.CHANGE_SELECTED_EMPLOYEE
				)
					? ['employee', 'employee.organization', 'employee.user']
					: [])
			],
			order: {
				startedAt: 'ASC'
			},
			where: (qb: SelectQueryBuilder<TimeLog>) => {
				this.getFilterTimeLogQuery(qb, request);
			}
		});
	}

	async getWeeklyReport(request: IGetTimeLogReportInput) {
		const logs = await this.timeLogRepository.find({
			join: {
				alias: 'timeLogs',
				innerJoin: {
					employee: 'timeLogs.employee'
				}
			},
			relations: [
				'project',
				'task',
				'organizationContact',
				...(RequestContext.hasPermission(
					PermissionsEnum.CHANGE_SELECTED_EMPLOYEE
				)
					? ['employee', 'employee.organization', 'employee.user']
					: [])
			],
			order: {
				startedAt: 'ASC'
			},
			where: (qb: SelectQueryBuilder<TimeLog>) => {
				this.getFilterTimeLogQuery(qb, request);
			}
		});

		let dayList = [];
		const range = {};
		let i = 0;
		const start = moment(request.startDate);
		while (start.isSameOrBefore(request.endDate) && i < 7) {
			const date = start.format('YYYY-MM-DD');
			range[date] = null;
			start.add(1, 'day');
			i++;
		}
		dayList = Object.keys(range);

		const weeklyLogs = _.chain(logs)
			.groupBy('employeeId')
			.map((innerLogs: ITimeLog[], _projectId) => {
				const byDate = _.chain(innerLogs)
					.groupBy((log) =>
						moment(log.startedAt).format('YYYY-MM-DD')
					)
					.mapObject((res: ITimeLog[]) => {
						const sum = res.reduce((iteratee: any, log: any) => {
							return iteratee + log.duration;
						}, 0);
						return { sum, logs: res };
					})
					.value();

				const employee =
					innerLogs.length > 0 ? innerLogs[0].employee : null;
				const dates: any = {};
				dayList.forEach((date) => {
					dates[date] = byDate[date] || 0;
				});
				return { employee, dates };
			})
			.value();

		return weeklyLogs;
	}

	async getDailyReportChartData(request: IGetTimeLogReportInput) {
		const logs = await this.timeLogRepository.find({
			join: {
				alias: 'timeLogs',
				innerJoin: {
					employee: 'timeLogs.employee',
					timeSlot: 'timeLogs.timeSlots'
				}
			},
			order: {
				startedAt: 'ASC'
			},
			where: (qb: SelectQueryBuilder<TimeLog>) => {
				this.getFilterTimeLogQuery(qb, request);
			}
		});

		let dayList = [];
		const range = {};
		let i = 0;
		const start = moment(request.startDate);
		while (start.isSameOrBefore(request.endDate) && i < 7) {
			const date = start.format('YYYY-MM-DD');
			range[date] = null;
			start.add(1, 'day');
			i++;
		}
		dayList = Object.keys(range);

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
					.filter((log) => log.logType === TimeLogType.IDEAL)
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
						[TimeLogType.IDEAL]: parseFloat(
							(ideal / 3600).toFixed(1)
						),
						[TimeLogType.RESUMED]: parseFloat(
							(resumed / 3600).toFixed(1)
						)
					}
				};
			})
			.value();

		const dates = dayList.map((date) => {
			if (byDate[date]) {
				return byDate[date];
			} else {
				return {
					date: date,
					value: {
						[TimeLogType.TRACKED]: 0,
						[TimeLogType.MANUAL]: 0,
						[TimeLogType.IDEAL]: 0,
						[TimeLogType.RESUMED]: 0
					}
				};
			}
		});

		return dates;
	}

	async getDailyReport(request: IGetTimeLogReportInput) {
		const logs = await this.timeLogRepository.find({
			join: {
				alias: 'timeLogs',
				innerJoin: {
					employee: 'timeLogs.employee',
					timeSlot: 'timeLogs.timeSlots'
				}
			},
			relations: [
				'project',
				'task',
				'timeSlots',
				'organizationContact',
				...(RequestContext.hasPermission(
					PermissionsEnum.CHANGE_SELECTED_EMPLOYEE
				)
					? ['employee', 'employee.organization', 'employee.user']
					: [])
			],
			order: {
				startedAt: 'ASC'
			},
			where: (qb: SelectQueryBuilder<TimeLog>) => {
				this.getFilterTimeLogQuery(qb, request);
			}
		});

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
		const timeLogs = await this.timeLogRepository.find({
			relations: ['employee', 'employee.user'],
			order: {
				startedAt: 'ASC'
			},
			where: (qb: SelectQueryBuilder<TimeLog>) => {
				this.getFilterTimeLogQuery(qb, request);
			}
		});

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
		const timeLogs = await this.timeLogRepository.find({
			relations: ['employee', 'employee.user'],
			order: {
				startedAt: 'ASC'
			},
			where: (qb: SelectQueryBuilder<TimeLog>) => {
				this.getFilterTimeLogQuery(qb, request);
			}
		});

		let dayList = [];
		const range = {};
		let i = 0;
		const start = moment(request.startDate);
		while (start.isSameOrBefore(request.endDate) && i < 7) {
			const date = start.format('YYYY-MM-DD');
			range[date] = null;
			start.add(1, 'day');
			i++;
		}
		dayList = Object.keys(range);

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

		const dates = dayList.map((date) => {
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
		const timeLogs = await this.timeLogRepository.find({
			relations: ['employee', 'employee.user'],
			order: {
				startedAt: 'ASC'
			},
			where: (qb: SelectQueryBuilder<TimeLog>) => {
				this.getFilterTimeLogQuery(qb, request);
			}
		});

		let dayList = [];
		const range = {};
		let i = 0;
		const start = moment(request.startDate);
		while (start.isSameOrBefore(request.endDate) && i < 7) {
			const date = start.format('YYYY-MM-DD');
			range[date] = null;
			start.add(1, request.duration);
			i++;
		}
		dayList = Object.keys(range);

		// const employees = await this.employeeRepository.find({
		// 	organizationId: request.organizationId
		// });

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
							durationPercentage: durationPercentage.toFixed(2),
							limit
						};
					})
					.value();

				return { date, employees: byEmployee };
			})
			.value();

		const dates = dayList.map((date) => {
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

	async projectBudgetLimit(request: IProjectBudgetLimitReportInput) {
		const { organizationId } = request;
		const tenantId = RequestContext.currentTenantId();

		const query = this.organizationProjectRepository.createQueryBuilder('organization_project');
		query.innerJoinAndSelect(`${query.alias}.timeLogs`, 'timeLogs');
		query.innerJoinAndSelect(`timeLogs.employee`, 'employee');
		query.andWhere(
			new Brackets((qb: WhereExpression) => {
				qb.where(`"${query.alias}"."organizationId" =:organizationId`, { organizationId });
				qb.andWhere(`"${query.alias}"."tenantId" =:tenantId`, { tenantId });
			})
		);
		query.andWhere(
			new Brackets((qb: WhereExpression) => {
				qb.where(`"timeLogs"."organizationId" =:organizationId`, { organizationId });
				qb.andWhere(`"timeLogs"."tenantId" =:tenantId`, { tenantId });
			})
		);

		const organizationProjects = await query.getMany();
		const projects = organizationProjects.map(
			(project: IOrganizationProject): IProjectBudgetLimitReport => {
				let spent = 0;
				let spentPercentage = 0;
				const { budgetType, budget = 0 } = project;

				if (
					project.budgetType ==
					OrganizationProjectBudgetTypeEnum.HOURS
				) {
					spent = project.timeLogs.reduce(
						(iteratee: any, log: any) => {
							return iteratee + log.duration;
						},
						0
					);
					spentPercentage = (spent * 100) / budget;
				} else {
					spent = project.timeLogs.reduce(
						(iteratee: any, log: any) => {
							let amount = 0;
							if (log.employee) {
								amount = log.duration * 60 * 60 * log.employee.billRateValue;
							}
							return iteratee + amount;
						},
						0
					);
					spentPercentage = (spent * 100) / budget;
				}
				const reamingBudget = Math.max(budget - spent, 0);
				return {
					project,
					budgetType,
					budget,
					spent: spent,
					reamingBudget,
					spentPercentage: parseFloat(spentPercentage.toFixed(2))
				};
			}
		);
		return projects;
	}

	async clientBudgetLimit(request: IClientBudgetLimitReportInput) {
		const { organizationId } = request;
		const tenantId = RequestContext.currentTenantId();
	
		const query = this.organizationProjectRepository.createQueryBuilder('organization_project');
		query.innerJoinAndSelect(`${query.alias}.organizationContact`, 'organizationContact');
		query.innerJoinAndSelect(`${query.alias}.timeLogs`, 'timeLogs');
		query.innerJoinAndSelect(`timeLogs.employee`, 'employee');
		query.andWhere(
			new Brackets((qb: WhereExpression) => {
				qb.where(`"${query.alias}"."organizationId" =:organizationId`, { organizationId });
				qb.andWhere(`"${query.alias}"."tenantId" =:tenantId`, { tenantId });
			})
		);
		query.andWhere(
			new Brackets((qb: WhereExpression) => {
				qb.where(`"organizationContact"."organizationId" =:organizationId`, { organizationId });
				qb.andWhere(`"organizationContact"."tenantId" =:tenantId`, { tenantId });
			})
		);
		query.andWhere(
			new Brackets((qb: WhereExpression) => {
				qb.where(`"timeLogs"."organizationId" =:organizationId`, { organizationId });
				qb.andWhere(`"timeLogs"."tenantId" =:tenantId`, { tenantId });
			})
		);
		const clientProjects = await query.getMany();
		const projects = clientProjects.map(
			(project: IOrganizationProject): IClientBudgetLimitReport => {
				const { organizationContact } = project;
				const { budgetType, budget } = organizationContact;
				let spent = 0;
				let spentPercentage = 0;
				if (budgetType == OrganizationContactBudgetTypeEnum.HOURS) {
					spent = project.timeLogs.reduce(
						(iteratee: any, log: any) => {
							return iteratee + log.duration;
						},
						0
					);
					spentPercentage = (spent * 100) / budget;
				} else {
					spent = project.timeLogs.reduce(
						(iteratee: any, log: any) => {
							let amount = 0;
							if (log.employee) {
								amount = log.duration * 60 * 60 * log.employee.billRateValue;
							}
							return iteratee + amount;
						},
						0
					);
					spentPercentage = (spent * 100) / budget;
				}
				const reamingBudget = Math.max(budget - spent, 0);
				return {
					organizationContact,
					budgetType,
					budget,
					spent: spent,
					reamingBudget,
					spentPercentage: parseFloat(spentPercentage.toFixed(2))
				};
			}
		);
		return projects;
	}

	getFilterTimeLogQuery(
		qb: SelectQueryBuilder<TimeLog>,
		request: IGetTimeLogInput
	) {
		let employeeIds: string[];

		if (
			RequestContext.hasPermission(
				PermissionsEnum.CHANGE_SELECTED_EMPLOYEE
			)
		) {
			if (request.employeeIds) {
				employeeIds = request.employeeIds;
			}
		} else {
			const user = RequestContext.currentUser();
			employeeIds = [user.employeeId];
		}

		qb.where({ deletedAt: null });

		if (request.timesheetId) {
			qb.andWhere('"timesheetId" = :timesheetId', {
				timesheetId: request.timesheetId
			});
		}

		if (request.startDate && request.endDate) {
			let startDate: any = moment.utc(request.startDate);
			let endDate: any = moment.utc(request.endDate);

			if (this.configService.dbConnectionOptions.type === 'sqlite') {
				startDate = startDate.format('YYYY-MM-DD HH:mm:ss');
				endDate = endDate.format('YYYY-MM-DD HH:mm:ss');
			} else {
				startDate = startDate.toDate();
				endDate = endDate.toDate();
			}

			qb.andWhere(
				`"${qb.alias}"."startedAt" >= :startDate AND "${qb.alias}"."startedAt" < :endDate`,
				{ startDate, endDate }
			);
		}

		if (employeeIds) {
			qb.andWhere(`"${qb.alias}"."employeeId" IN (:...employeeId)`, {
				employeeId: employeeIds
			});
		}

		if (request.projectIds) {
			qb.andWhere(`"${qb.alias}"."projectId" IN (:...projectIds)`, {
				projectIds: request.projectIds
			});
		}

		if (request.source) {
			if (request.source instanceof Array) {
				qb.andWhere(`"${qb.alias}"."source" IN (:...source)`, {
					source: request.source
				});
			} else {
				qb.andWhere(`"${qb.alias}"."source" = :source`, {
					source: request.source
				});
			}
		}

		if (request.logType) {
			if (request.logType instanceof Array) {
				qb.andWhere(`"${qb.alias}"."logType" IN (:...logType)`, {
					logType: request.logType
				});
			} else {
				qb.andWhere(`"${qb.alias}"."logType" = :logType`, {
					logType: request.logType
				});
			}
		}

		// check organization and tenant for timelogs
		if (request.organizationId) {
			qb.andWhere(`"${qb.alias}"."organizationId" = :organizationId`, {
				organizationId: request.organizationId
			});
		}

		const tenantId = RequestContext.currentTenantId();
		if (tenantId) {
			qb.andWhere(`"${qb.alias}"."tenantId" = :tenantId`, {
				tenantId
			});
		}
		return qb;
	}

	async addManualTime(request: IManualTimeInput): Promise<TimeLog> {
		
		const tenantId = RequestContext.currentTenantId();
		const { employeeId, startedAt, stoppedAt, organizationId } = request;

		if (!startedAt || !stoppedAt) {
			throw new BadRequestException(
				'Please select valid Date, start time and end time'
			);
		}

		const employee = await this.employeeRepository.findOne(
			employeeId,
			{ relations: ['organization'] }
		);

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
			employeeId: employeeId,
			startDate: startedAt,
			endDate: stoppedAt,
			organizationId,
			tenantId,
			...(request.id ? { ignoreId: request.id } : {})
		});

		const times: IDateRange = {
			start: new Date(startedAt),
			end: new Date(stoppedAt)
		};
		
		for await (const conflict of conflicts)  {
			await this.commandBus.execute(
				new DeleteTimeSpanCommand(times, conflict)
			);
		}

		return await this.commandBus.execute(
			new TimeLogCreateCommand(request)
		);
	}

	async updateTime(id: string, request: IManualTimeInput): Promise<TimeLog> {
		if (!request.startedAt || !request.stoppedAt) {
			throw new BadRequestException(
				'Please select valid Date start and end time'
			);
		}
		const employee = await this.employeeRepository.findOne(
			request.employeeId,
			{ relations: ['organization'] }
		);
		const isDateAllow = this.allowDate(
			request.startedAt,
			request.stoppedAt,
			employee.organization
		);

		if (!isDateAllow) {
			throw new BadRequestException(
				'Please select valid Date start and end time'
			);
		}

		const timeLog = await this.timeLogRepository.findOne(request.id);
		if (request.startedAt || request.stoppedAt) {
			const conflict = await this.checkConflictTime({
				employeeId: timeLog.employeeId,
				startDate: request.startedAt || timeLog.startedAt,
				endDate: request.stoppedAt || timeLog.stoppedAt,
				...(id ? { ignoreId: id } : {})
			});

			const times: IDateRange = {
				start: new Date(request.startedAt),
				end: new Date(request.stoppedAt)
			};

			for (let index = 0; index < conflict.length; index++) {
				await this.commandBus.execute(
					new DeleteTimeSpanCommand(times, conflict[index])
				);
			}
		}

		await this.commandBus.execute(
			new TimeLogUpdateCommand(request, timeLog)
		);

		return await this.timeLogRepository.findOne(request.id);
	}

	async deleteTimeLog(ids: string | string[]): Promise<any> {
		const user = RequestContext.currentUser();
		if (typeof ids === 'string') {
			ids = [ids];
		}

		const timeLogs = await this.timeLogRepository.find({
			...(RequestContext.hasPermission(
				PermissionsEnum.CHANGE_SELECTED_EMPLOYEE
			)
				? {}
				: { employeeId: user.employeeId }),
			id: In(ids)
		});

		return await this.commandBus.execute(
			new TimeLogDeleteCommand(timeLogs, true)
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
