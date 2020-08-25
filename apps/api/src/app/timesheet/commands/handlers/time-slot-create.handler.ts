import { BadRequestException } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import * as moment from 'moment';
import { TimeSlot } from '@gauzy/models';
import { TimeSlotCreateCommand } from '../time-slot-create.command';
import { TimeSlotService } from '../../time-slot/time-slot.service';

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
			}: TimeSlot = input;

			return await this._timeSlotService.create({
				employeeId,
				duration,
				keyboard,
				mouse,
				overall,
				startedAt: new Date(
					moment(time_slot).format('YYYY-MM-DD HH:mm:ss')
				)
			});
		} catch (error) {
			throw new BadRequestException('Cant create time slot');
		}
	}
}
