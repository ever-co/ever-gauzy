import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { ID, ITimeLog, ITimeSlot } from '@gauzy/contracts';
import { isEmpty, isNotEmpty } from '@gauzy/common';
import { TimeSlotBulkDeleteCommand } from '../time-slot-bulk-delete.command';
import { RequestContext } from '../../../../core/context';
import { prepareSQLQuery as p } from './../../../../database/database.helper';
import { TypeOrmTimeSlotRepository } from '../../repository/type-orm-time-slot.repository';

@CommandHandler(TimeSlotBulkDeleteCommand)
export class TimeSlotBulkDeleteHandler implements ICommandHandler<TimeSlotBulkDeleteCommand> {
	constructor(private readonly typeOrmTimeSlotRepository: TypeOrmTimeSlotRepository) {}

	/**
	 * Execute bulk deletion of time slots
	 *
	 * @param command - The command containing input and deletion options
	 * @returns Promise<boolean> - Returns true if deletion was successful, otherwise false
	 */
	public async execute(command: TimeSlotBulkDeleteCommand): Promise<ITimeSlot | ITimeSlot[]> {
		const { input, forceDelete, entireSlots } = command;
		const { organizationId, employeeId, timeLog, timeSlotsIds = [] } = input;
		const tenantId = RequestContext.currentTenantId() ?? input.tenantId;

		// Step 1: Fetch time slots based on input parameters
		const timeSlots = await this.fetchTimeSlots({ organizationId, employeeId, tenantId, timeSlotsIds });
		console.log({ timeSlots, forceDelete }, 'Time Slots Delete Range');

		// If timeSlots is empty, return an empty array
		if (isEmpty(timeSlots)) {
			return [];
		}

		// Step 2: Handle deletion based on the entireSlots flag
		if (entireSlots) {
			return await this.bulkDeleteTimeSlots(timeSlots, forceDelete);
		} else {
			return await this.conditionalDeleteTimeSlots(timeSlots, timeLog, forceDelete);
		}
	}

	/**
	 * Fetches time slots based on the provided parameters.
	 *
	 * @param params - The parameters for querying time slots.
	 * @returns A promise that resolves to an array of time slots.
	 */
	private async fetchTimeSlots(params: {
		organizationId: ID;
		employeeId: ID;
		tenantId: ID;
		timeSlotsIds: ID[];
	}): Promise<ITimeSlot[]> {
		const { organizationId, employeeId, tenantId, timeSlotsIds } = params;

		// Create a query builder for the TimeSlot entity
		const query = this.typeOrmTimeSlotRepository.createQueryBuilder();

		// Set the find options for the query
		query.setFindOptions({
			relations: { timeLogs: true, screenshots: true }
		});

		query.andWhere(p(`"${query.alias}"."employeeId" = :employeeId`), { employeeId });
		query.andWhere(p(`"${query.alias}"."organizationId" = :organizationId`), { organizationId });
		query.andWhere(p(`"${query.alias}"."tenantId" = :tenantId`), { tenantId });

		// If timeSlotsIds is not empty, add a WHERE clause to the query
		if (isNotEmpty(timeSlotsIds)) {
			query.andWhere(p(`"${query.alias}"."id" IN (:...timeSlotsIds)`), { timeSlotsIds });
		}

		console.log('Time Slots Delete Range Query', query.getQueryAndParameters());
		return await query.getMany();
	}

	/**
	 * Handles bulk deletion of time slots, either soft or hard delete based on the `forceDelete` flag.
	 *
	 * @param timeSlots - The time slots to delete.
	 * @param forceDelete - A boolean flag to indicate whether to hard delete or soft delete.
	 * @returns A promise that resolves to true after deletion.
	 */
	private async bulkDeleteTimeSlots(timeSlots: ITimeSlot[], forceDelete: boolean): Promise<ITimeSlot[]> {
		if (forceDelete) {
			return await this.typeOrmTimeSlotRepository.remove(timeSlots);
		} else {
			return await this.typeOrmTimeSlotRepository.softRemove(timeSlots);
		}
	}

	/**
	 * Conditionally deletes time slots based on associated time logs.
	 *
	 * If a time slot only has one time log and that time log matches the provided one, the time slot is deleted.
	 *
	 * @param timeSlots - The time slots to conditionally delete.
	 * @param timeLog - The specific time log to check for deletion.
	 * @param forceDelete - A boolean flag to indicate whether to hard delete or soft delete.
	 * @returns A promise that resolves to true after deletion.
	 */
	private async conditionalDeleteTimeSlots(
		timeSlots: ITimeSlot[],
		timeLog: ITimeLog,
		forceDelete: boolean
	): Promise<ITimeSlot> {
		// Loop through each time slot
		for (const timeSlot of timeSlots) {
			const { timeLogs } = timeSlot;
			// If the time slot has only one time log and it matches the provided time log, delete the time slot
			if (timeLogs.length === 1 && timeLogs[0].id === timeLog.id) {
				if (forceDelete) {
					return await this.typeOrmTimeSlotRepository.remove(timeSlot);
				} else {
					return await this.typeOrmTimeSlotRepository.softRemove(timeSlot);
				}
			}
		}
	}
}
