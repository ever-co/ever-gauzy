import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { BadRequestException } from '@nestjs/common';
import { TimeSlotMinuteCreateCommand } from '../time-slot-minute-create.command';
import { TimeSlotService } from '../../time-slot/time-slot.service';
import { TimeSlotMinute } from '../../time-slot-minute.entity';

@CommandHandler(TimeSlotMinuteCreateCommand)
export class TimeSlotMinuteCreateHandler
	implements ICommandHandler<TimeSlotMinuteCreateCommand> {
	constructor(private _timeSlotService: TimeSlotService) {}

	public async execute(
		command: TimeSlotMinuteCreateCommand
	): Promise<TimeSlotMinute> {
		try {
			const { input } = command;
			const { keyboard, mouse, datetime, timeSlot } = input;

			return await this._timeSlotService.createTimeSlotMinute({
				keyboard,
				mouse,
				datetime,
				timeSlot
			});
		} catch (error) {
			throw new BadRequestException('Cant create time slot minute');
		}
	}
}
