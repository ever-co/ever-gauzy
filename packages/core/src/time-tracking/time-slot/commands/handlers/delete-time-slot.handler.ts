import { CommandHandler, ICommandHandler, CommandBus } from '@nestjs/cqrs';
import { NotAcceptableException } from '@nestjs/common';
import { ID, ITimeSlot, PermissionsEnum } from '@gauzy/contracts';
import { isEmpty, isNotEmpty } from '@gauzy/common';
import { DeleteTimeSpanCommand } from '../../../time-log/commands/delete-time-span.command';
import { DeleteTimeSlotCommand } from '../delete-time-slot.command';
import { RequestContext } from './../../../../core/context';
import { prepareSQLQuery as p } from './../../../../database/database.helper';
import { TypeOrmTimeSlotRepository } from '../../repository/type-orm-time-slot.repository';

@CommandHandler(DeleteTimeSlotCommand)
export class DeleteTimeSlotHandler implements ICommandHandler<DeleteTimeSlotCommand> {
	constructor(
		private readonly typeOrmTimeSlotRepository: TypeOrmTimeSlotRepository,
		private readonly commandBus: CommandBus
	) {}

	/**
	 * Executes the command to delete time slots based on the provided query.
	 *
	 * This method processes the deletion of time slots based on the provided IDs in the query.
	 * It checks for the current user's permission to change selected employees, and if not permitted,
	 * restricts the deletion to the current user's time slots. The method handles deleting time spans
	 * for each time slot, ensuring that only non-running time logs are deleted.
	 *
	 * @param command - The `DeleteTimeSlotCommand` containing the query with time slot IDs and organization data.
	 * @returns A promise that resolves to `true` if the deletion process is successful, or throws an exception if no IDs are provided.
	 * @throws NotAcceptableException if no time slot IDs are provided in the query.
	 */
	public async execute(command: DeleteTimeSlotCommand): Promise<boolean> {
		const { ids, organizationId, forceDelete } = command.options;

		// Throw an error if no IDs are provided
		if (isEmpty(ids)) {
			throw new NotAcceptableException('You can not delete time slots');
		}

		// Retrieve the tenant ID from the current request context
		const tenantId = RequestContext.currentTenantId() || command.options.tenantId;

		// Check if the current user has the permission to change the selected employee
		const hasChangeSelectedEmployeePermission: boolean = RequestContext.hasPermission(
			PermissionsEnum.CHANGE_SELECTED_EMPLOYEE
		);
		const employeeIds: ID[] = !hasChangeSelectedEmployeePermission ? [RequestContext.currentEmployeeId()] : [];

		for await (const id of Object.values(ids)) {
			// Create a query builder for the TimeSlot entity
			const query = this.typeOrmTimeSlotRepository.createQueryBuilder();

			// Set the find options for the query
			query.setFindOptions({
				relations: { timeLogs: true }
			});

			// Add where clauses to the query
			query.where(p(`"${query.alias}"."id" = :id`), { id });
			query.andWhere(p(`"${query.alias}"."tenantId" = :tenantId`), { tenantId });
			query.andWhere(p(`"${query.alias}"."organizationId" = :organizationId`), { organizationId });

			// Restrict deletion based on employeeId if permission is not granted
			if (isNotEmpty(employeeIds)) {
				query.andWhere(p(`"${query.alias}"."employeeId" IN (:...employeeIds)`), { employeeIds });
			}

			// Order by creation date
			query.addOrderBy(p(`"${query.alias}"."createdAt"`), 'ASC');
			const timeSlots: ITimeSlot[] = await query.getMany();

			// If no time slots are found, stop processing
			if (isEmpty(timeSlots)) {
				continue;
			}

			console.log(`time slots for soft delete or hard delete:`, timeSlots);

			// Loop through each time slot
			for await (const timeSlot of timeSlots) {
				if (isNotEmpty(timeSlot.timeLogs)) {
					// Filter non-running time logs
					const nonRunningTimeLogs = timeSlot.timeLogs.filter((timeLog) => !timeLog.isRunning);

					// Delete non-running time logs
					if (isNotEmpty(nonRunningTimeLogs)) {
						// Sequentially execute delete commands for non-running time logs
						for await (const timeLog of nonRunningTimeLogs) {
							// Delete time span for non-running time log
							await this.commandBus.execute(
								new DeleteTimeSpanCommand(
									{
										start: timeSlot.startedAt,
										end: timeSlot.stoppedAt
									},
									timeLog,
									timeSlot,
									forceDelete
								)
							);
						}
					}
				}
			}
		}

		return true;
	}
}
