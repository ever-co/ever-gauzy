import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TimeSlotMinute } from './../../time-slot-minute.entity';
import { UpdateTimeSlotMinutesCommand } from '../update-time-slot-minutes.command';

@CommandHandler(UpdateTimeSlotMinutesCommand)
export class UpdateTimeSlotMinutesHandler
	implements ICommandHandler<UpdateTimeSlotMinutesCommand> {
	constructor(
		@InjectRepository(TimeSlotMinute)
		private readonly timeSlotMinuteRepository: Repository<TimeSlotMinute>
	) {}

	public async execute(
		command: UpdateTimeSlotMinutesCommand
	): Promise<TimeSlotMinute> {
		const { input, id } = command;

		let timeMinute = await this.timeSlotMinuteRepository.findOne({
			where: {
				id: id
			}
		});

		if (timeMinute) {
			delete input.timeSlotId;
			await this.timeSlotMinuteRepository.update(id, input);

			const [timeMinute] = await this.timeSlotMinuteRepository.find({
				where: {
					id: id
				},
				relations: {
					timeSlot: true
				}
			})
			return timeMinute;
		} else {
			return null;
		}
	}
}
