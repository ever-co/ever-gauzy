import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { TimeSlotMinute } from './../../time-slot-minute.entity';
import { UpdateTimeSlotMinutesCommand } from '../update-time-slot-minutes.command';
import { TypeOrmTimeSlotMinuteRepository } from '../../repositories/type-orm-time-slot-minute.repository';

@CommandHandler(UpdateTimeSlotMinutesCommand)
export class UpdateTimeSlotMinutesHandler implements ICommandHandler<UpdateTimeSlotMinutesCommand> {
	constructor(private readonly typeOrmTimeSlotMinuteRepository: TypeOrmTimeSlotMinuteRepository) {}

	/**
	 * Updates an existing `TimeSlotMinute` entity by its ID.
	 *
	 * If the entity is found, it updates the record with the given input data
	 * (excluding `timeSlotId` to prevent relational inconsistency), then fetches
	 * and returns the updated record with its `timeSlot` relation.
	 *
	 * @param command - Contains the ID of the time slot minute and updated input data.
	 * @returns A Promise resolving to the updated `TimeSlotMinute` entity, or `null` if not found.
	 */
	public async execute(command: UpdateTimeSlotMinutesCommand): Promise<TimeSlotMinute> {
		const { input, id } = command;

		const timeMinute = await this.typeOrmTimeSlotMinuteRepository.findOneBy({ id });

		if (timeMinute) {
			// Prevent changing the timeSlot relation – remove the key entirely
			if ('timeSlotId' in input) {
				delete (input as any).timeSlotId;
			}

			await this.typeOrmTimeSlotMinuteRepository.update(id, input);
			// Fetch and return the updated entity including its timeSlot relation
			return await this.typeOrmTimeSlotMinuteRepository.findOne({
				where: { id },
				relations: { timeSlot: true }
			});
		}

		return null;
	}
}
