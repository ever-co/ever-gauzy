import { TimeSlot } from '@gauzy/models';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { TimeSlotCreateCommand } from '..';
import { TimeSlotService } from '../../time-slot/time-slot.service';
import { BadRequestException } from '@nestjs/common';

@CommandHandler(TimeSlotCreateCommand)
export class TimeSlotCreateHandler
	implements ICommandHandler<TimeSlotCreateCommand> {
	constructor(private _timeSlotService: TimeSlotService) {}

	public async execute(command: TimeSlotCreateCommand): Promise<TimeSlot> {
		try {
			const { input } = command;
			const {
				employeeId,
				duration,
				keyboard,
				mouse,
				overall,
				time_slot
			} = input;

			return await this._timeSlotService.create({
				employeeId,
				duration,
				keyboard,
				mouse,
				overall,
				startedAt: time_slot
			});
		} catch (error) {
			throw new BadRequestException('Cant create time slot');
		}
	}
}
