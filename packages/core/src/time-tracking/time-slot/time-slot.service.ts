import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { CommandBus } from '@nestjs/cqrs';
import { Brackets, SelectQueryBuilder, WhereExpressionBuilder } from 'typeorm';
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
	CreateTimeSlotMinutesCommand,
	TimeSlotBulkCreateCommand,
	TimeSlotBulkCreateOrUpdateCommand,
	UpdateTimeSlotMinutesCommand
} from './commands';
import { prepareSQLQuery as p } from './../../database/database.helper';
import { TypeOrmTimeSlotRepository } from './repository/type-orm-time-slot.repository';
import { MikroOrmTimeSlotRepository } from './repository/mikro-orm-time-slot.repository';

@Injectable()
export class TimeSlotService extends TenantAwareCrudService<TimeSlot> {
	constructor(
		@InjectRepository(TimeSlot)
		typeOrmTimeSlotRepository: TypeOrmTimeSlotRepository,

		mikroOrmTimeSlotRepository: MikroOrmTimeSlotRepository,

		private readonly commandBus: CommandBus
	) {
		super(typeOrmTimeSlotRepository, mikroOrmTimeSlotRepository);
	}

	/**
	 * Retrieves time slots based on the provided input parameters.
	 * @param request - Input parameters for querying time slots.
	 * @returns A list of time slots matching the specified criteria.
	 */
	async getTimeSlots(request: IGetTimeSlotInput) {
		// Extract parameters from the request object
		const { organizationId, startDate, endDate, syncSlots = false } = request;
		let { employeeIds = [] } = request;

		const tenantId = RequestContext.currentTenantId();
		const user = RequestContext.currentUser();

		// Calculate start and end dates using a utility function
		const { start, end } = getDateRangeFormat(
			moment.utc(startDate || moment().startOf('day')),
			moment.utc(endDate || moment().endOf('day'))
		);

		// Check if the current user has the permission to change the selected employee
		const hasChangeSelectedEmployeePermission: boolean = RequestContext.hasPermission(
			PermissionsEnum.CHANGE_SELECTED_EMPLOYEE
		);

		// Determine if the request specifies to retrieve data for the current user only
		const isOnlyMeSelected: boolean = request.onlyMe;

		// Set employeeIds based on permissions and request
		if ((user.employeeId && isOnlyMeSelected) || (!hasChangeSelectedEmployeePermission && user.employeeId)) {
			employeeIds = [user.employeeId];
		}

		// Create a query builder for the TimeSlot entity
		const query = this.typeOrmRepository.createQueryBuilder('time_slot');
		query.leftJoin(`${query.alias}.employee`, 'employee');
		query.innerJoin(`${query.alias}.timeLogs`, 'time_log');

		query.setFindOptions({
			// Define selected fields for the result
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
			relations: [...(request.relations ? request.relations : [])]
		});
		query.where((qb: SelectQueryBuilder<TimeSlot>) => {
			qb.andWhere(
				new Brackets((web: WhereExpressionBuilder) => {
					web.andWhere(p(`"${qb.alias}"."startedAt" BETWEEN :startDate AND :endDate`), {
						startDate: start,
						endDate: end
					});
					if (isEmpty(syncSlots)) {
						web.andWhere(p(`"time_log"."startedAt" BETWEEN :startDate AND :endDate`), {
							startDate: start,
							endDate: end
						});
					}
				})
			);
			qb.andWhere(
				new Brackets((web: WhereExpressionBuilder) => {
					if (isNotEmpty(employeeIds)) {
						web.andWhere(p(`"${qb.alias}"."employeeId" IN (:...employeeIds)`), {
							employeeIds
						});
						web.andWhere(p(`"time_log"."employeeId" IN (:...employeeIds)`), {
							employeeIds
						});
					}
					if (isNotEmpty(request.projectIds)) {
						const { projectIds } = request;
						web.andWhere(p('"time_log"."projectId" IN (:...projectIds)'), {
							projectIds
						});
					}
				})
			);
			qb.andWhere(
				new Brackets((web: WhereExpressionBuilder) => {
					// Filters records based on the overall column, representing the activity level.
					if (isNotEmpty(request.activityLevel)) {
						/**
						 * Activity Level should be 0-100%
						 * Convert it into a 10-minute time slot by multiplying by 6
						 */
						const { activityLevel } = request;

						web.andWhere(p(`"${qb.alias}"."overall" BETWEEN :start AND :end`), {
							start: activityLevel.start * 6,
							end: activityLevel.end * 6
						});
					}

					// Filters records based on the source column.
					if (isNotEmpty(request.source)) {
						const { source } = request;

						const condition = source instanceof Array ? p(`"time_log"."source" IN (:...source)`) : p(`"time_log"."source" = :source`);
						web.andWhere(condition, { source });
					}

					// Filters records based on the logType column.
					if (isNotEmpty(request.logType)) {
						const { logType } = request;
						const condition = logType instanceof Array ? p(`"time_log"."logType" IN (:...logType)`) : p(`"time_log"."logType" = :logType`);

						web.andWhere(condition, { logType });
					}
				})
			);
			// Additional conditions for filtering by tenantId and organizationId
			qb.andWhere(
				new Brackets((web: WhereExpressionBuilder) => {
					web.andWhere(p(`"time_log"."tenantId" = :tenantId`), { tenantId });
					web.andWhere(p(`"time_log"."organizationId" = :organizationId`), { organizationId });
				})
			);
			// Additional conditions for filtering by tenantId and organizationId
			qb.andWhere(
				new Brackets((web: WhereExpressionBuilder) => {
					web.andWhere(p(`"${qb.alias}"."tenantId" = :tenantId`), { tenantId });
					web.andWhere(p(`"${qb.alias}"."organizationId" = :organizationId`), { organizationId });
				})
			);
			qb.addOrderBy(p(`"${qb.alias}"."createdAt"`), 'ASC');
		});
		const slots = await query.getMany();
		return slots;
	}

	/**
	 *
	 * @param slots
	 * @param employeeId
	 * @param organizationId
	 * @returns
	 */
	async bulkCreateOrUpdate(
		slots: ITimeSlot[],
		employeeId: ITimeSlot['employeeId'],
		organizationId: ITimeSlot['organizationId']
	) {
		return await this.commandBus.execute(
			new TimeSlotBulkCreateOrUpdateCommand(slots, employeeId, organizationId)
		);
	}

	/**
	 *
	 * @param slots
	 * @param employeeId
	 * @param organizationId
	 * @returns
	 */
	async bulkCreate(
		slots: ITimeSlot[],
		employeeId: ITimeSlot['employeeId'],
		organizationId: ITimeSlot['organizationId']
	) {
		return await this.commandBus.execute(
			new TimeSlotBulkCreateCommand(slots, employeeId, organizationId)
		);
	}

	/**
	 *
	 * @param start
	 * @param end
	 * @returns
	 */
	generateTimeSlots(start: Date, end: Date) {
		return generateTimeSlots(start, end);
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
