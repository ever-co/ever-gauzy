import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { CommandBus } from '@nestjs/cqrs';
import { Brackets, FindManyOptions, Repository, SelectQueryBuilder, WhereExpressionBuilder } from 'typeorm';
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
				...(request.relations ? request.relations : [])
			],
			where: (query: SelectQueryBuilder<TimeSlot>) => {
				query.andWhere(
					new Brackets((qb: WhereExpressionBuilder) => {
						qb.andWhere(`"${query.alias}"."startedAt" BETWEEN :startDate AND :endDate`, {
							startDate: start,
							endDate: end
						});
						if (isEmpty(syncSlots)) {
							qb.andWhere(`"timeLog"."startedAt" BETWEEN :startDate AND :endDate`, {
								startDate: start,
								endDate: end
							});
						}
					})
				);
				query.andWhere(
					new Brackets((qb: WhereExpressionBuilder) => {
						if (isNotEmpty(employeeIds)) {
							qb.andWhere(`"${query.alias}"."employeeId" IN (:...employeeIds)`, {
								employeeIds
							});
							qb.andWhere(`"timeLog"."employeeId" IN (:...employeeIds)`, {
								employeeIds
							});
						}
						if (isNotEmpty(request.projectIds)) {
							const { projectIds } = request;
							qb.andWhere('"timeLog"."projectId" IN (:...projectIds)', {
								projectIds
							});
						}
					})
				);
				query.andWhere(
					new Brackets((qb: WhereExpressionBuilder) => {
						if (isNotEmpty(request.activityLevel)) {
							/**
							 * Activity Level should be 0-100%
							 * So, we have convert it into 10 minutes TimeSlot by multiply by 6
							 */
							const { activityLevel } = request;
							const start = (activityLevel.start * 6);
							const end = (activityLevel.end * 6);

							qb.andWhere(`"${query.alias}"."overall" BETWEEN :start AND :end`, {
								start,
								end
							});
						}
						if (isNotEmpty(request.source)) {
							const { source } = request;
							if (source instanceof Array) {
								qb.andWhere('"timeLog"."source" IN (:...source)', {
									source
								});
							} else {
								qb.andWhere('"timeLog"."source" = :source', {
									source
								});
							}
						}
						if (isNotEmpty(request.logType)) {
							const { logType } = request;
							if (logType instanceof Array) {
								qb.andWhere('"timeLog"."logType" IN (:...logType)', {
									logType
								});
							} else {
								qb.andWhere('"timeLog"."logType" = :logType', {
									logType
								});
							}
						}
					})
				);
				query.andWhere(
					new Brackets((qb: WhereExpressionBuilder) => {
						qb.andWhere(`"timeLog"."tenantId" = :tenantId`, { tenantId });
						qb.andWhere(`"timeLog"."organizationId" = :organizationId`, { organizationId });
						qb.andWhere(`"timeLog"."deletedAt" IS NULL`);
					})
				);
				query.andWhere(
					new Brackets((qb: WhereExpressionBuilder) => {
						qb.andWhere(`"${query.alias}"."tenantId" = :tenantId`, { tenantId });
						qb.andWhere(`"${query.alias}"."organizationId" = :organizationId`, { organizationId });
					})
				);
				query.addOrderBy(`"${query.alias}"."createdAt"`, 'ASC');
				console.log('Get Screenshots Query And Parameters', query.getQueryAndParameters());
			}
		} as FindManyOptions<TimeSlot>);
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
