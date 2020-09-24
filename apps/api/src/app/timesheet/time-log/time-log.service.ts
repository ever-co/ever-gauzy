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
	IDateRange
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
				qb.where({
					deletedAt: null
				});
				if (request.timesheetId) {
					qb.andWhere('"timesheetId" = :timesheetId', {
						timesheetId: request.timesheetId
					});
				}
				if (request.startDate && request.endDate) {
					const startDate = moment.utc(request.startDate).toDate();
					const endDate = moment.utc(request.endDate).toDate();
					console.log({ startDate, endDate });
					qb.andWhere('"startedAt" Between :startDate AND :endDate', {
						startDate,
						endDate
					});
				}
				if (employeeIds) {
					qb.andWhere('"employeeId" IN (:...employeeId)', {
						employeeId: employeeIds
					});
				}

				if (request.projectIds) {
					qb.andWhere(
						`"${qb.alias}"."projectId" IN (:...projectIds)`,
						{ projectIds: request.projectIds }
					);
				}
				if (request.activityLevel) {
					// qb.andWhere('"overall" BETWEEN :start AND :end', request.activityLevel);
				}
				if (request.source) {
					if (request.source instanceof Array) {
						qb.andWhere('"source" IN (:...source)', {
							source: request.source
						});
					} else {
						qb.andWhere('"source" = :source', {
							source: request.source
						});
					}
				}
				if (request.logType) {
					if (request.logType instanceof Array) {
						qb.andWhere('"logType" IN (:...logType)', {
							logType: request.logType
						});
					} else {
						qb.andWhere('"logType" = :logType', {
							logType: request.logType
						});
					}
				}

				//check organization and tenant for timelogs
				let { organizationId = null, tenantId = null } = request;
				if (typeof organizationId === 'string') {
					qb.andWhere(
						`"${qb.alias}"."organizationId" = :organizationId`,
						{ organizationId: request.organizationId }
					);
				}
				//if not found tenantId then get from current user session
				if (typeof tenantId !== 'string') {
					const user = RequestContext.currentUser();
					tenantId = user.tenantId;
				}
				qb.andWhere(`"${qb.alias}"."tenantId" = :tenantId`, {
					tenantId
				});
			}
		});
		return logs;
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
