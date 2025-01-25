import { CommandHandler, ICommandHandler, CommandBus } from '@nestjs/cqrs';
import { CreateTimeSlotMinutesCommand } from '../create-time-slot-minutes.command';
import { TimeSlotMinute } from './../../time-slot-minute.entity';
import { UpdateTimeSlotMinutesCommand } from '../update-time-slot-minutes.command';
import { RequestContext } from '../../../../core/context';
import { TypeOrmTimeSlotMinuteRepository } from '../../repository/type-orm-time-slot-minute.repository';

@CommandHandler(CreateTimeSlotMinutesCommand)
export class CreateTimeSlotMinutesHandler implements ICommandHandler<CreateTimeSlotMinutesCommand> {
	constructor(
		private readonly typeOrmTimeSlotMinuteRepository: TypeOrmTimeSlotMinuteRepository,
		private readonly commandBus: CommandBus
	) {}

	public async execute(command: CreateTimeSlotMinutesCommand): Promise<TimeSlotMinute> {
		const { input } = command;
		const { id: timeSlotId } = input.timeSlot;

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
			input.tenantId = RequestContext.currentTenantId();
			return this.typeOrmTimeSlotMinuteRepository.save(input);
		}
	}
}
