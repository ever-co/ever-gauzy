import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { CommandBus } from '@nestjs/cqrs';
import { Brackets, Repository, SelectQueryBuilder, WhereExpressionBuilder } from 'typeorm';
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
		const { organizationId } = request;
		const tenantId = RequestContext.currentTenantId();

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
			where: (query: SelectQueryBuilder<TimeSlot>) => {
				if (isNotEmpty(request.startDate) && isNotEmpty(request.endDate)) {
					const { start: startDate, end: endDate } = getDateFormat(
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
					query.andWhere(`"timeLog"."employeeId" IN (:...employeeIds)`, {
						employeeIds
					});
				}
				if (isNotEmpty(request.projectIds)) {
					const { projectIds } = request;
					query.andWhere('"timeLog"."projectId" IN (:...projectIds)', {
						projectIds
					});
				}
				if (isNotEmpty(request.activityLevel)) {
					/**
					 * Activity Level should be 0-100%
					 * So, we have convert it into 10 minutes TimeSlot by multiply by 6
					 */
					const { activityLevel } = request;
					const start = (activityLevel.start * 6);
					const end = (activityLevel.end * 6);

					query.andWhere(`"${query.alias}"."overall" BETWEEN :start AND :end`, {
						start,
						end
					});
				}
				if (isNotEmpty(request.source)) {
					const { source } = request;
					if (source instanceof Array) {
						query.andWhere('"timeLog"."source" IN (:...source)', {
							source: source
						});
					} else {
						query.andWhere('"timeLog"."source" = :source', {
							source: source
						});
					}
				}
				if (isNotEmpty(request.logType)) {
					const { logType } = request;
					if (logType instanceof Array) {
						query.andWhere('"timeLog"."logType" IN (:...logType)', {
							logType
						});
					} else {
						query.andWhere('"timeLog"."logType" = :logType', {
							logType
						});
					}
				}
				query.andWhere(
					new Brackets((qb: WhereExpressionBuilder) => { 
						qb.andWhere(`"${query.alias}"."tenantId" = :tenantId`, { tenantId });
						qb.andWhere(`"${query.alias}"."organizationId" = :organizationId`, { organizationId });
					})
				);
				query.addOrderBy(`"${query.alias}"."createdAt"`, 'ASC');
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
