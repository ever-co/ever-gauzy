import { CommandHandler, ICommandHandler, CommandBus } from '@nestjs/cqrs';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CreateTimeSlotMinutesCommand } from '../create-time-slot-minutes.command';
import { TimeSlotMinute } from '../../../time-slot-minute.entity';
import { UpdateTimeSlotMinutesCommand } from '../update-time-slot-minutes.command';
import { RequestContext } from '../../../../core/context';

@CommandHandler(CreateTimeSlotMinutesCommand)
export class CreateTimeSlotMinutesHandler
	implements ICommandHandler<CreateTimeSlotMinutesCommand> {
	constructor(
		@InjectRepository(TimeSlotMinute)
		private readonly timeSlotMinuteRepository: Repository<TimeSlotMinute>,
		private readonly commandBus: CommandBus
	) {}

	public async execute(
		command: CreateTimeSlotMinutesCommand
	): Promise<TimeSlotMinute> {
		const { input } = command;

		const timeMinute = await this.timeSlotMinuteRepository.findOne({
			where: {
				timeSlot: input.timeSlot,
				datetime: input.datetime
			}
		});

		if (timeMinute) {
			return this.commandBus.execute(
				new UpdateTimeSlotMinutesCommand(timeMinute.id, {
					...input,
					timeSlotId: timeMinute.id
				})
			);
		} else {
			input.tenantId = RequestContext.currentTenantId();
			return this.timeSlotMinuteRepository.save(input);
		}
	}
}
