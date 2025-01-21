import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { TimeSlotMinute } from './../../time-slot-minute.entity';
import { UpdateTimeSlotMinutesCommand } from '../update-time-slot-minutes.command';
import { TypeOrmTimeSlotMinuteRepository } from '../../repository/type-orm-time-slot-minute.repository';

@CommandHandler(UpdateTimeSlotMinutesCommand)
export class UpdateTimeSlotMinutesHandler implements ICommandHandler<UpdateTimeSlotMinutesCommand> {
	constructor(private readonly typeOrmTimeSlotMinuteRepository: TypeOrmTimeSlotMinuteRepository) {}

	public async execute(command: UpdateTimeSlotMinutesCommand): Promise<TimeSlotMinute> {
		const { input, id } = command;
		let timeMinute = await this.typeOrmTimeSlotMinuteRepository.findOneBy({
			id
		});

		if (timeMinute) {
			delete input.timeSlotId;
			await this.typeOrmTimeSlotMinuteRepository.update(id, input);

			return await this.typeOrmTimeSlotMinuteRepository.findOne({
				where: {
					id: id
				},
				relations: {
					timeSlot: true
				}
			});
		} else {
			return null;
		}
	}
}
