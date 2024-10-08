import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import * as chalk from 'chalk';
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
		// Extract organizationId, employeeId, timeLog, and timeSlotsIds from the input
		const { organizationId, employeeId, timeLog, timeSlotsIds = [] } = input;
		// Retrieve the tenant ID from the current request context or the provided input
		const tenantId = RequestContext.currentTenantId() ?? input.tenantId;

		// Step 1: Fetch time slots based on input parameters
		const timeSlots = await this.fetchTimeSlots({ organizationId, employeeId, tenantId, timeSlotsIds });
		console.log(`fetched time slots for soft delete or hard delete:`, timeSlots);

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
	private async fetchTimeSlots({
		organizationId,
		employeeId,
		tenantId,
		timeSlotsIds = []
	}: {
		organizationId: ID;
		employeeId: ID;
		tenantId: ID;
		timeSlotsIds: ID[];
	}): Promise<ITimeSlot[]> {
		// Create a query builder for the TimeSlot entity
		const query = this.typeOrmTimeSlotRepository.createQueryBuilder();
		query
			.leftJoinAndSelect(`${query.alias}.timeLogs`, 'timeLogs')
			.leftJoinAndSelect(`${query.alias}.screenshots`, 'screenshots')
			.leftJoinAndSelect(`${query.alias}.activities`, 'activities')
			.leftJoinAndSelect(`${query.alias}.timeSlotMinutes`, 'timeSlotMinutes');

		query
			.where(p(`"${query.alias}"."employeeId" = :employeeId`), { employeeId })
			.andWhere(p(`"${query.alias}"."organizationId" = :organizationId`), { organizationId })
			.andWhere(p(`"${query.alias}"."tenantId" = :tenantId`), { tenantId });

		// If timeSlotsIds is not empty, add a WHERE clause to the query
		if (isNotEmpty(timeSlotsIds)) {
			query.andWhere(p(`"${query.alias}"."id" IN (:...timeSlotsIds)`), { timeSlotsIds });
		}

		console.log('fetched time slots by parameters:', query.getParameters());
		return await query.getMany();
	}

	/**
	 * Handles bulk deletion of time slots, either soft or hard delete based on the `forceDelete` flag.
	 *
	 * @param timeSlots - The time slots to delete.
	 * @param forceDelete - A boolean flag to indicate whether to hard delete or soft delete.
	 * @returns A promise that resolves to the deleted time slots.
	 */
	private bulkDeleteTimeSlots(timeSlots: ITimeSlot[], forceDelete: boolean): Promise<ITimeSlot[]> {
		return forceDelete
			? this.typeOrmTimeSlotRepository.remove(timeSlots)
			: this.typeOrmTimeSlotRepository.softRemove(timeSlots);
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
		console.log('conditional delete time slots:', timeSlots);
		// Loop through each time slot
		for await (const timeSlot of timeSlots) {
			const { timeLogs = [] } = timeSlot;
			const [firstTimeLog] = timeLogs;

			console.log('Matching TimeLog ID:', firstTimeLog.id === timeLog.id);
			console.log('TimeSlots Ids Will Be Deleted:', timeSlot.id);

			if (timeLogs.length === 1) {
				const [firstTimeLog] = timeLogs;
				if (timeLogs.length === 1 && firstTimeLog.id === timeLog.id) {
					// If the time slot has only one time log and it matches the provided time log, delete the time slot
					if (forceDelete) {
						console.log(
							chalk.red('--------------------hard removing time slot--------------------'),
							timeSlot.id
						);
						return await this.typeOrmTimeSlotRepository.remove(timeSlot);
					} else {
						console.log(
							chalk.yellow('--------------------soft removing time slot--------------------'),
							timeSlot.id
						);
						return await this.typeOrmTimeSlotRepository.softRemove(timeSlot);
					}
				}
			}
		}
	}
}
