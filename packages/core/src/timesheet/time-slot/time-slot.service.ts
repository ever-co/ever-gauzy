import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, SelectQueryBuilder } from 'typeorm';
import { CrudService } from '../../core/crud/crud.service';
import { TimeSlot } from '../time-slot.entity';
import { moment } from '../../core/moment-extend';
import { RequestContext } from '../../core/context/request-context';
import { PermissionsEnum, IGetTimeSlotInput } from '@gauzy/contracts';
import { TimeSlotMinute } from '../time-slot-minute.entity';
import { generateTimeSlots } from './utils';
import { CommandBus } from '@nestjs/cqrs';
import { CreateTimeSlotCommand } from './commands/create-time-slot.command';
import { UpdateTimeSlotCommand } from './commands/update-time-slot.command';
import { TimeSlotBulkCreateOrUpdateCommand } from './commands/time-slot-bulk-create-or-update.command';
import { TimeSlotBulkCreateCommand } from './commands/time-slot-bulk-create.command';
import { CreateTimeSlotMinutesCommand } from './commands/create-time-slot-minutes.command';
import { UpdateTimeSlotMinutesCommand } from './commands/update-time-slot-minutes.command';
import { DeleteTimeSlotCommand } from './commands/delete-time-slot.command';
import { TimeSlotRangeDeleteCommand } from './commands/time-slot-range-delete.command';

@Injectable()
export class TimeSlotService extends CrudService<TimeSlot> {
	constructor(
		@InjectRepository(TimeSlot)
		private readonly timeSlotRepository: Repository<TimeSlot>,
		private readonly commandBus: CommandBus
	) {
		super(timeSlotRepository);
	}

	async getTimeSlots(request: IGetTimeSlotInput) {
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

		const logs = await this.timeSlotRepository.find({
			join: {
				alias: 'time_slot',
				leftJoin: {
					employee: 'time_slot.employee',
					timeLog: 'time_slot.timeLogs'
				}
			},
			relations: [
				...(RequestContext.hasPermission(
					PermissionsEnum.CHANGE_SELECTED_EMPLOYEE
				)
					? ['employee', 'employee.user']
					: []),
				...(request.relations ? request.relations : [])
			],
			where: (qb: SelectQueryBuilder<TimeSlot>) => {
				if (request.startDate && request.endDate) {
					const startDate = moment
						.utc(request.startDate)
						.format('YYYY-MM-DD HH:mm:ss');
					const endDate = moment
						.utc(request.endDate)
						.format('YYYY-MM-DD HH:mm:ss');
					qb.andWhere(
						`"${qb.alias}"."startedAt" Between :startDate AND :endDate`,
						{
							startDate,
							endDate
						}
					);
				}
				if (employeeIds) {
					qb.andWhere(
						`"${qb.alias}"."employeeId" IN (:...employeeId)`,
						{
							employeeId: employeeIds
						}
					);
				}

				//check organization and tenant for timelogs
				if (request.organizationId) {
					qb.andWhere(
						`"${qb.alias}"."organizationId" = :organizationId`,
						{
							organizationId: request.organizationId
						}
					);
				}
				const tenantId = RequestContext.currentTenantId();
				if (tenantId) {
					qb.andWhere(`"${qb.alias}"."tenantId" = :tenantId`, {
						tenantId
					});
				}

				if (request.projectIds) {
					qb.andWhere('"timeLog"."projectId" IN (:...projectIds)', {
						projectIds: request.projectIds
					});
				}
				if (request.activityLevel) {
					qb.andWhere(
						`"${qb.alias}"."overall" BETWEEN :start AND :end`,
						request.activityLevel
					);
				}
				if (request.source) {
					if (request.source instanceof Array) {
						qb.andWhere('"timeLog"."source" IN (:...source)', {
							source: request.source
						});
					} else {
						qb.andWhere('"timeLog"."source" = :source', {
							source: request.source
						});
					}
				}
				if (request.logType) {
					if (request.logType instanceof Array) {
						qb.andWhere('"timeLog"."logType" IN (:...logType)', {
							logType: request.logType
						});
					} else {
						qb.andWhere('"timeLog"."logType" = :logType', {
							logType: request.logType
						});
					}
				}
				qb.addOrderBy(`"${qb.alias}"."createdAt"`, 'ASC');
			}
		});
		return logs;
	}

	async bulkCreateOrUpdate(slots) {
		return this.commandBus.execute(
			new TimeSlotBulkCreateOrUpdateCommand(slots)
		);
	}

	async bulkCreate(slots) {
		return this.commandBus.execute(new TimeSlotBulkCreateCommand(slots));
	}

	async rangeDelete(employeeId: string, start: Date, stop: Date) {
		return this.commandBus.execute(
			new TimeSlotRangeDeleteCommand(employeeId, start, stop)
		);
	}

	generateTimeSlots(start: Date, end: Date) {
		return generateTimeSlots(start, end);
	}

	async create(request: TimeSlot) {
		return this.commandBus.execute(new CreateTimeSlotCommand(request));
	}

	async update(id: string, request: TimeSlot) {
		return this.commandBus.execute(new UpdateTimeSlotCommand(id, request));
	}

	/*
	 *create time slot minute activity for specific timeslot
	 */
	async createTimeSlotMinute(request: TimeSlotMinute) {
		// const { keyboard, mouse, datetime, timeSlot } = request;

		return this.commandBus.execute(
			new CreateTimeSlotMinutesCommand(request)
		);
	}

	/*
	 * Update timeslot minute activity for specific timeslot
	 */
	async updateTimeSlotMinute(id: string, request: TimeSlotMinute) {
		return this.commandBus.execute(
			new UpdateTimeSlotMinutesCommand(id, request)
		);
	}

	async deleteTimeSlot(ids: string[]) {
		return this.commandBus.execute(new DeleteTimeSlotCommand(ids));
	}
}
