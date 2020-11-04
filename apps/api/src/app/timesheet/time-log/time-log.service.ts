import { Injectable, BadRequestException } from '@nestjs/common';
import { TimeLog } from '../time-log.entity';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In, SelectQueryBuilder } from 'typeorm';
import { RequestContext } from '../../core/context';
import {
	IManualTimeInput,
	IGetTimeLogInput,
	PermissionsEnum,
	IGetTimeLogConflictInput,
	IDateRange,
	IGetTimeLogReportInput,
	ITimeLog,
	ITimeSlot
} from '@gauzy/models';
import * as moment from 'moment';
import { CrudService } from '../../core';
import { Organization } from '../../organization/organization.entity';
import { Employee } from '../../employee/employee.entity';
import { CommandBus } from '@nestjs/cqrs';
import { TimeLogCreateCommand } from './commands/time-log-create.command';
import { TimeLogUpdateCommand } from './commands/time-log-update.command';
import { TimeLogDeleteCommand } from './commands/time-log-delete.command';
import { DeleteTimeSpanCommand } from './commands/delete-time-span.command';
import { IGetConflictTimeLogCommand } from './commands/get-conflict-time-log.command';
import * as _ from 'underscore';
import { AnyCnameRecord } from 'dns';

@Injectable()
export class TimeLogService extends CrudService<TimeLog> {
	constructor(
		private commandBus: CommandBus,

		@InjectRepository(TimeLog)
		private readonly timeLogRepository: Repository<TimeLog>,

		@InjectRepository(Employee)
		private readonly employeeRepository: Repository<Employee>
	) {
		super(timeLogRepository);
	}

	async getTimeLogs(request: IGetTimeLogInput) {
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
		return logs;
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

	async getDailyReport(request: IGetTimeLogReportInput) {
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

		const dailyLogs = _.chain(logs)

			.groupBy((log) => moment(log.startedAt).format('YYYY-MM-DD'))
			.map((byDateLogs: ITimeLog[], date) => {
				const byProject = _.chain(byDateLogs)
					.groupBy('projectId')
					.map((byProjectLogs: ITimeLog[], projectId) => {
						const project =
							byProjectLogs.length > 0
								? byProjectLogs[0].project
								: null;

						const task =
							byProjectLogs.length > 0
								? byProjectLogs[0].task
								: null;

						const byEmployee = _.chain(byProjectLogs)
							.groupBy('employeeId')
							.map((byEmployeeLogs: ITimeLog[], date) => {
								const sum = byEmployeeLogs.reduce(
									(iteratee: any, log: any) => {
										return iteratee + log.duration;
									},
									0
								);

								const timeSlots: ITimeSlot[] = _.chain(
									byEmployeeLogs
								)
									.pluck('timeSlots')
									.flatten(true)
									.value();

								const activitiesSum =
									byEmployeeLogs.reduce(
										(iteratee: any, timeSlot: any) => {
											return iteratee + timeSlot.overall;
										},
										0
									) || 0;

								const activity =
									activitiesSum / timeSlots.length;

								const employee =
									byEmployeeLogs.length > 0
										? byEmployeeLogs[0].employee
										: null;
								return {
									employee,
									sum: sum,
									activity: activity
								};
							})
							.value();

						return {
							project,
							projectLogs: byEmployee,
							task: task
						};
					})
					.value();

				return { date, logs: byProject };
			})
			.value();

		return dailyLogs;
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

		qb.where({
			deletedAt: null
		});
		if (request.timesheetId) {
			qb.andWhere('"timesheetId" = :timesheetId', {
				timesheetId: request.timesheetId
			});
		}
		if (request.startDate && request.endDate) {
			const startDate = moment.utc(request.startDate).format();
			const endDate = moment.utc(request.endDate).format();
			console.log({ startDate, endDate });
			qb.andWhere(
				`"${qb.alias}"."startedAt" Between :startDate AND :endDate`,
				{
					startDate,
					endDate
				}
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
		if (request.activityLevel) {
			// qb.andWhere('"overall" BETWEEN :start AND :end', request.activityLevel);
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
		if (!request.startedAt || !request.stoppedAt) {
			throw new BadRequestException(
				'Please select valid Date, start time and end time'
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
				'Please select valid Date, start time and end time'
			);
		}

		const conflict = await this.checkConflictTime({
			employeeId: request.employeeId,
			startDate: request.startedAt,
			endDate: request.stoppedAt,
			...(request.id ? { ignoreId: request.id } : {})
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

		const timeLog = await this.commandBus.execute(
			new TimeLogCreateCommand(request)
		);

		return timeLog;
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
			new TimeLogDeleteCommand(timeLogs)
		);
	}

	async checkConflictTime(request: IGetTimeLogConflictInput) {
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
