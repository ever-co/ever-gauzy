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
			const { fullUrl, thumbUrl, recordedAt, timeSlot } = input;

			const {
				record: findTimeSlot
			} = await this._timeSlotService.findOneOrFail({
				where: {
					startedAt: moment(timeSlot).format('YYYY-MM-DD HH:mm:ss')
				}
			});

			const {
				record: screenshot
			} = await this._screenshotService.findOneOrFail({
				where: {
					timeSlotId: findTimeSlot
				}
			});

			if (!screenshot) {
				return await this._screenshotService.create({
					timeSlotId: findTimeSlot,
					fullUrl,
					thumbUrl,
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
