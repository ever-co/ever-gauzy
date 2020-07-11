import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { TimeSlotMinuteCreateCommand } from '../time-slot-minute-create.command ';
import { TimeSlotService } from '../../time-slot/time-slot.service';
import { BadRequestException } from '@nestjs/common';
import * as moment from 'moment';
import { TimeSlotMinute } from '../../time-slot-minute.entity';

@CommandHandler(TimeSlotMinuteCreateCommand)
export class TimeSlotCreateHandler
	implements ICommandHandler<TimeSlotMinuteCreateCommand> {
	constructor(private _timeSlotService: TimeSlotService) {}

	public async execute(command: TimeSlotMinuteCreateCommand) {
		try {
			const { input } = command;
			const { keyboard, mouse, datetime, timeSlot } = input;

			console.log(input, 'input');
			return await input;
		} catch (error) {
			throw new BadRequestException('Cant create time slot minute');
		}
	}
}
