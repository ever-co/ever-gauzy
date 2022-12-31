import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { CommandBus } from '@nestjs/cqrs';
import { Brackets, Repository, SelectQueryBuilder, WhereExpressionBuilder } from 'typeorm';
import { PermissionsEnum, IGetTimeSlotInput, ITimeSlot } from '@gauzy/contracts';
import { isEmpty, isNotEmpty } from '@gauzy/common';
import { TenantAwareCrudService } from './../../core/crud';
import { moment } from '../../core/moment-extend';
import { RequestContext } from '../../core/context';
import { getDateRangeFormat } from './../../core/utils';
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
		const { organizationId, startDate, endDate, syncSlots = false } = request;
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

		const { start, end } = (startDate && endDate) ?
								getDateRangeFormat(
									moment.utc(startDate),
									moment.utc(endDate)
								) :
								getDateRangeFormat(
									moment().startOf('day').utc(),
									moment().endOf('day').utc()
								);

		const query = this.timeSlotRepository.createQueryBuilder('time_slot');
		query.setFindOptions({
			join: {
				alias: 'time_slot',
				leftJoin: {
					employee: 'time_slot.employee'
				},
				innerJoin: {
					time_log: 'time_slot.timeLogs'
				}
			},
			select: {
				organization: {
					id: true,
					name: true
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
			relations: [
				...(request.relations ? request.relations : [])
			]
		});
		query.where((qb: SelectQueryBuilder<TimeSlot>) => {
			qb.andWhere(
				new Brackets((web: WhereExpressionBuilder) => {
					web.andWhere(`"${qb.alias}"."startedAt" BETWEEN :startDate AND :endDate`, {
						startDate: start,
						endDate: end
					});
					if (isEmpty(syncSlots)) {
						web.andWhere(`"time_log"."startedAt" BETWEEN :startDate AND :endDate`, {
							startDate: start,
							endDate: end
						});
					}
				})
			);
			qb.andWhere(
				new Brackets((web: WhereExpressionBuilder) => {
					if (isNotEmpty(employeeIds)) {
						web.andWhere(`"${qb.alias}"."employeeId" IN (:...employeeIds)`, {
							employeeIds
						});
						web.andWhere(`"time_log"."employeeId" IN (:...employeeIds)`, {
							employeeIds
						});
					}
					if (isNotEmpty(request.projectIds)) {
						const { projectIds } = request;
						web.andWhere('"time_log"."projectId" IN (:...projectIds)', {
							projectIds
						});
					}
				})
			);
			qb.andWhere(
				new Brackets((web: WhereExpressionBuilder) => {
					if (isNotEmpty(request.activityLevel)) {
						/**
						 * Activity Level should be 0-100%
						 * So, we have convert it into 10 minutes TimeSlot by multiply by 6
						 */
						const { activityLevel } = request;
						const start = (activityLevel.start * 6);
						const end = (activityLevel.end * 6);

						web.andWhere(`"${qb.alias}"."overall" BETWEEN :start AND :end`, {
							start,
							end
						});
					}
					if (isNotEmpty(request.source)) {
						const { source } = request;
						if (source instanceof Array) {
							web.andWhere('"time_log"."source" IN (:...source)', {
								source
							});
						} else {
							web.andWhere('"time_log"."source" = :source', {
								source
							});
						}
					}
					if (isNotEmpty(request.logType)) {
						const { logType } = request;
						if (logType instanceof Array) {
							web.andWhere('"time_log"."logType" IN (:...logType)', {
								logType
							});
						} else {
							web.andWhere('"time_log"."logType" = :logType', {
								logType
							});
						}
					}
				})
			);
			qb.andWhere(
				new Brackets((web: WhereExpressionBuilder) => {
					web.andWhere(`"time_log"."tenantId" = :tenantId`, { tenantId });
					web.andWhere(`"time_log"."organizationId" = :organizationId`, { organizationId });
					web.andWhere(`"time_log"."deletedAt" IS NULL`);
				})
			);
			qb.andWhere(
				new Brackets((web: WhereExpressionBuilder) => {
					web.andWhere(`"${qb.alias}"."tenantId" = :tenantId`, { tenantId });
					web.andWhere(`"${qb.alias}"."organizationId" = :organizationId`, { organizationId });
				})
			);
			qb.addOrderBy(`"${qb.alias}"."createdAt"`, 'ASC');
			console.log('Get Screenshots Query And Parameters', qb.getQueryAndParameters());
		});
		const slots = await query.getMany();
		return slots;
	}

	async bulkCreateOrUpdate(
		slots: ITimeSlot[],
		employeeId: ITimeSlot['employeeId'],
		organizationId: ITimeSlot['organizationId'],
	) {
		return await this.commandBus.execute(
			new TimeSlotBulkCreateOrUpdateCommand(
				slots,
				employeeId,
				organizationId
			)
		);
	}

	async bulkCreate(
		slots: ITimeSlot[],
		employeeId: ITimeSlot['employeeId'],
		organizationId: ITimeSlot['organizationId'],
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

	async update(id: TimeSlot['id'], request: TimeSlot) {
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
