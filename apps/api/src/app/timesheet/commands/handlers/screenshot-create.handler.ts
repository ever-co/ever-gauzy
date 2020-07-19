import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { BadRequestException } from '@nestjs/common';
import * as moment from 'moment';
import { ScreenshotCreateCommand } from '..';
import { ScreenshotService } from '../../screenshot/screenshot.service';
import { TimeSlotService } from '../../time-slot/time-slot.service';

@CommandHandler(ScreenshotCreateCommand)
export class ScreenshotCreateHandler
	implements ICommandHandler<ScreenshotCreateCommand> {
	constructor(
		private _screenshotService: ScreenshotService,
		private _timeSlotService: TimeSlotService
	) {}

	public async execute(command: ScreenshotCreateCommand): Promise<any> {
		try {
			const { input } = command;
			const {
				file,
				thumb,
				recordedAt,
				activityTimestamp,
				employeeId
			} = input;

			let {
				record: timeSlot
			} = await this._timeSlotService.findOneOrFail({
				where: {
					startedAt: moment(activityTimestamp).toDate()
				}
			});

			//if timeslot not found for this screenshot then create new timeslot
			if (!timeSlot) {
				timeSlot = await this._timeSlotService.create({
					employeeId,
					duration: 0,
					keyboard: 0,
					mouse: 0,
					overall: 0,
					startedAt: moment(activityTimestamp).toDate()
				});
			}

			const {
				record: screenshot
			} = await this._screenshotService.findOneOrFail({
				where: {
					timeSlotId: timeSlot
				}
			});

			if (!screenshot) {
				return await this._screenshotService.create({
					timeSlotId: timeSlot,
					file,
					thumb,
					recordedAt
				});
			}

			return screenshot;
		} catch (error) {
			throw new BadRequestException(
				'Cant create screenshot for time slot'
			);
		}
	}
}
