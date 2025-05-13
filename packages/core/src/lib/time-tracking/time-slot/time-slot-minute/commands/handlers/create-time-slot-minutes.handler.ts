import { CommandHandler, ICommandHandler, CommandBus } from '@nestjs/cqrs';
import { RequestContext } from '../../../../../core/context';
import { CreateTimeSlotMinutesCommand } from '../create-time-slot-minutes.command';
import { UpdateTimeSlotMinutesCommand } from '../update-time-slot-minutes.command';
import { TimeSlotMinute } from '../../time-slot-minute.entity';
import { TypeOrmTimeSlotMinuteRepository } from '../../repositories/type-orm-time-slot-minute.repository';

@CommandHandler(CreateTimeSlotMinutesCommand)
export class CreateTimeSlotMinutesHandler implements ICommandHandler<CreateTimeSlotMinutesCommand> {
	constructor(
		private readonly commandBus: CommandBus,
		private readonly typeOrmTimeSlotMinuteRepository: TypeOrmTimeSlotMinuteRepository
	) {}

	/**
	 * Handles creation or update of a time slot minute record.
	 *
	 * If a `TimeSlotMinute` already exists for the given `timeSlotId` and `datetime`,
	 * it performs an update via `UpdateTimeSlotMinutesCommand`. Otherwise, it creates a new one.
	 *
	 * @param command - The command containing input data for a time slot minute.
	 * @returns A Promise that resolves to the created or updated `TimeSlotMinute` entity.
	 */
	public async execute(command: CreateTimeSlotMinutesCommand): Promise<TimeSlotMinute> {
		const { input } = command;
		const { id: timeSlotId } = input.timeSlot;

		// Extract tenant ID from the request context or the provided input
		const tenantId = RequestContext.currentTenantId() ?? input.tenantId;

		// Check if a time slot minute already exists for the given time slot ID and datetime
		const timeMinute = await this.typeOrmTimeSlotMinuteRepository.findOneBy({
			timeSlotId: timeSlotId,
			datetime: input.datetime
		});

		if (timeMinute) {
			return this.commandBus.execute(
				new UpdateTimeSlotMinutesCommand(timeMinute.id, {
					...input,
					timeSlotId: timeMinute.id
				})
			);
		} else {
			return this.typeOrmTimeSlotMinuteRepository.save({
				...input,
				tenantId
			});
		}
	}
}
