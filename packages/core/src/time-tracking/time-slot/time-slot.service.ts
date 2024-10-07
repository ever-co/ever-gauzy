import { Injectable } from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import { Brackets, SelectQueryBuilder, WhereExpressionBuilder } from 'typeorm';
import { PermissionsEnum, IGetTimeSlotInput, ID, ITimeSlot } from '@gauzy/contracts';
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
		readonly typeOrmTimeSlotRepository: TypeOrmTimeSlotRepository,
		readonly mikroOrmTimeSlotRepository: MikroOrmTimeSlotRepository,
		private readonly _commandBus: CommandBus
	) {
		super(typeOrmTimeSlotRepository, mikroOrmTimeSlotRepository);
	}

	/**
	 * Retrieves time slots based on the provided input parameters.
	 *
	 * @param request - Input parameters for querying time slots.
	 * @returns A list of time slots matching the specified criteria.
	 */
	async getTimeSlots(request: IGetTimeSlotInput) {
		// Extract parameters from the request object with default values
		let {
			organizationId,
			startDate,
			endDate,
			syncSlots = false,
			employeeIds = [],
			projectIds = [],
			activityLevel,
			source,
			logType,
			onlyMe: isOnlyMeSelected // Indicates whether to retrieve data for the current user only
		} = request;

		const tenantId = RequestContext.currentTenantId() ?? request.tenantId; // Retrieve the tenant ID from the request context or the provided input
		const user = RequestContext.currentUser(); // Retrieve the current user from the request context

		// Check if the current user has the permission to change the selected employee
		const hasChangeSelectedEmployeePermission: boolean = RequestContext.hasPermission(
			PermissionsEnum.CHANGE_SELECTED_EMPLOYEE
		);

		// Set employeeIds based on permissions and request
		if (user.employeeId && (isOnlyMeSelected || !hasChangeSelectedEmployeePermission)) {
			employeeIds = [user.employeeId];
		}

		// Calculate start and end dates using a utility function
		const { start, end } = getDateRangeFormat(
			moment.utc(startDate || moment().startOf('day')),
			moment.utc(endDate || moment().endOf('day'))
		);

		// Create a query builder for the TimeSlot entity
		const query = this.typeOrmRepository.createQueryBuilder('time_slot');
		query.leftJoin(
			`${query.alias}.employee`,
			'employee',
			`"employee"."tenantId" = :tenantId AND "employee"."organizationId" = :organizationId`,
			{ tenantId, organizationId }
		);
		query.innerJoin(`${query.alias}.timeLogs`, 'time_log');

		// Set find options for the query
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
			// Spread relations if provided, otherwise an empty array
			relations: request.relations || []
		});

		// Add where conditions to the query
		query.where((qb: SelectQueryBuilder<TimeSlot>) => {
			// Filter by time range for both time_slot and time_log
			qb.andWhere(p(`"${qb.alias}"."startedAt" BETWEEN :startDate AND :endDate`), {
				startDate: start,
				endDate: end
			});

			// If syncSlots is true, filter by time_log.startedAt
			if (isEmpty(syncSlots)) {
				qb.andWhere(p(`"time_log"."startedAt" BETWEEN :startDate AND :endDate`), {
					startDate: start,
					endDate: end
				});
			}

			// Filter by employeeIds and projectIds if provided
			if (isNotEmpty(employeeIds)) {
				qb.andWhere(p(`"${qb.alias}"."employeeId" IN (:...employeeIds)`), { employeeIds });
				qb.andWhere(p(`"time_log"."employeeId" IN (:...employeeIds)`), { employeeIds });
			}
			if (isNotEmpty(projectIds)) {
				qb.andWhere(p(`"time_log"."projectId" IN (:...projectIds)`), { projectIds });
			}

			// Filter by activity level if provided
			if (isNotEmpty(activityLevel)) {
				/**
				 * Activity Level should be 0-100%
				 * Convert it into a 10-minute time slot by multiplying by 6
				 */
				// Filters records based on the overall column, representing the activity level.
				qb.andWhere(p(`"${qb.alias}"."overall" BETWEEN :start AND :end`), {
					start: activityLevel.start * 6,
					end: activityLevel.end * 6
				});
			}

			// Filters records based on the source column.
			if (isNotEmpty(source)) {
				const whereClause =
					source instanceof Array
						? p(`"time_log"."source" IN (:...source)`)
						: p(`"time_log"."source" = :source`);

				qb.andWhere(whereClause, { source });
			}

			// Filter by logType if provided
			if (isNotEmpty(logType)) {
				const whereClause =
					logType instanceof Array
						? p(`"time_log"."logType" IN (:...logType)`)
						: p(`"time_log"."logType" = :logType`);

				qb.andWhere(whereClause, { logType });
			}

			// Filter by tenantId and organizationId for both time_slot and time_log in a single AND condition
			qb.andWhere(
				`"${qb.alias}"."tenantId" = :tenantId AND "${qb.alias}"."organizationId" = :organizationId AND
				"time_log"."tenantId" = :tenantId AND "time_log"."organizationId" = :organizationId`,
				{ tenantId, organizationId }
			);

			// Sort by createdAt
			qb.addOrderBy(`"${qb.alias}"."createdAt"`, 'ASC');
		});

		const slots = await query.getMany();
		return slots;
	}

	/**
	 * Bulk creates or updates time slots for a given employee within an organization.
	 *
	 * This method will either create new time slots or update existing ones based on
	 * the provided slots, employeeId, and organizationId. The actual logic for bulk
	 * creation or updating is delegated to a command handler (`TimeSlotBulkCreateOrUpdateCommand`).
	 *
	 * @param slots - An array of time slots to be created or updated.
	 * @param employeeId - The ID of the employee for whom the time slots belong.
	 * @param organizationId - The ID of the organization associated with the time slots.
	 * @returns A promise that resolves when the command is executed, performing bulk creation or update.
	 */
	async bulkCreateOrUpdate(slots: ITimeSlot[], employeeId: ID, organizationId: ID) {
		return await this._commandBus.execute(new TimeSlotBulkCreateOrUpdateCommand(slots, employeeId, organizationId));
	}

	/**
	 * Bulk create time slots for a given employee and organization
	 *
	 * @param slots The array of time slots to be created
	 * @param employeeId The ID of the employee
	 * @param organizationId The ID of the organization
	 * @returns The result of the bulk creation command
	 */
	async bulkCreate(slots: ITimeSlot[], employeeId: ID, organizationId: ID) {
		return await this._commandBus.execute(new TimeSlotBulkCreateCommand(slots, employeeId, organizationId));
	}

	/**
	 * Generates time slots between the start and end times at a given interval.
	 * @param start The start time of the range
	 * @param end The end time of the range
	 * @returns An array of generated time slots
	 */
	generateTimeSlots(start: Date, end: Date) {
		return generateTimeSlots(start, end);
	}

	/*
	 *create time slot minute activity for specific TimeSlot
	 */
	async createTimeSlotMinute(request: TimeSlotMinute) {
		// const { keyboard, mouse, datetime, timeSlot } = request;
		return await this._commandBus.execute(new CreateTimeSlotMinutesCommand(request));
	}

	/*
	 * Update TimeSlot minute activity for specific TimeSlot
	 */
	async updateTimeSlotMinute(id: ID, request: TimeSlotMinute) {
		return await this._commandBus.execute(new UpdateTimeSlotMinutesCommand(id, request));
	}
}
