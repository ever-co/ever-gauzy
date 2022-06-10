import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { CommandBus } from '@nestjs/cqrs';
import { Repository, SelectQueryBuilder } from 'typeorm';
import { PermissionsEnum, IGetTimeSlotInput, ITimeSlot } from '@gauzy/contracts';
import { isNotEmpty } from '@gauzy/common';
import { TenantAwareCrudService } from './../../core/crud';
import { moment } from '../../core/moment-extend';
import { RequestContext } from '../../core/context';
import { getDateFormat } from './../../core/utils';
import { generateTimeSlots } from './utils';
import { TimeSlot } from './time-slot.entity';
import { TimeSlotMinute } from './time-slot-minute.entity';
import {
	CreateTimeSlotCommand,
	CreateTimeSlotMinutesCommand,
	TimeSlotBulkCreateCommand,
	TimeSlotBulkCreateOrUpdateCommand,
	UpdateTimeSlotCommand,
	UpdateTimeSlotMinutesCommand
} from './commands';

@Injectable()
export class TimeSlotService extends TenantAwareCrudService<TimeSlot> {
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

		const slots = await this.timeSlotRepository.find({
			join: {
				alias: 'time_slot',
				leftJoin: {
					employee: 'time_slot.employee'
				},
				innerJoin: {
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
					const { start: startDate, end: endDate } = getDateFormat(
						moment.utc(request.startDate),
						moment.utc(request.endDate)
					);
					qb.andWhere(`"${qb.alias}"."startedAt" >= :startDate AND "${qb.alias}"."startedAt" < :endDate`, {
						startDate, endDate
					});
				}
				if (isNotEmpty(employeeIds)) {
					qb.andWhere(`"${qb.alias}"."employeeId" IN (:...employeeIds)`, {
						employeeIds
					});
				}

				// check organization and tenant for timelogs
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
					/**
					 * Activity Level should be 0-100%
					 * So, we have convert it into 10 minutes TimeSlot by multiply by 6
					 */
					const { activityLevel } = request;
					const start = (activityLevel.start * 6);
					const end = (activityLevel.end * 6);

					qb.andWhere(`"${qb.alias}"."overall" BETWEEN :start AND :end`, {
						start,
						end
					});
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
		return slots;
	}

	async bulkCreateOrUpdate(slots) {
		return await this.commandBus.execute(
			new TimeSlotBulkCreateOrUpdateCommand(slots)
		);
	}

	async bulkCreate(
		slots: ITimeSlot[],
		employeeId: string,
		organizationId: string
	) {
		return await this.commandBus.execute(
			new TimeSlotBulkCreateCommand(
				slots,
				employeeId,
				organizationId
			)
		);
	}

	generateTimeSlots(start: Date, end: Date) {
		return generateTimeSlots(start, end);
	}

	async create(request: TimeSlot) {
		return await this.commandBus.execute(
			new CreateTimeSlotCommand(request)
		);
	}

	async update(id: string, request: TimeSlot) {
		return await this.commandBus.execute(
			new UpdateTimeSlotCommand(id, request)
		);
	}

	/*
	 *create time slot minute activity for specific TimeSlot
	 */
	async createTimeSlotMinute(request: TimeSlotMinute) {
		// const { keyboard, mouse, datetime, timeSlot } = request;
		return await this.commandBus.execute(
			new CreateTimeSlotMinutesCommand(request)
		);
	}

	/*
	 * Update TimeSlot minute activity for specific TimeSlot
	 */
	async updateTimeSlotMinute(id: string, request: TimeSlotMinute) {
		return await this.commandBus.execute(
			new UpdateTimeSlotMinutesCommand(id, request)
		);
	}
}
