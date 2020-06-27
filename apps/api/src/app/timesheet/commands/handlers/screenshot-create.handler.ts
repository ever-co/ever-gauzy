import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { BadRequestException } from '@nestjs/common';
import * as moment from 'moment';
import { ScreenshotCreateCommand } from '..';
import { ScreenShotService } from '../../screenshot.service';
import { TimeSlotService } from '../../time-slot.service';

@CommandHandler(ScreenshotCreateCommand)
export class ScreenshotCreateHandler
	implements ICommandHandler<ScreenshotCreateCommand> {
	constructor(
		private _screenshotService: ScreenShotService,
		private _timeSlotService: TimeSlotService
	) {}

	public async execute(command: ScreenshotCreateCommand): Promise<any> {
		try {
			const { input } = command;
			const { fullUrl, thumbUrl, recordedAt, timeSlot } = input;

			const { record } = await this._timeSlotService.findOneOrFail({
				where: {
					startedAt: moment(timeSlot).format('YYYY-MM-DD HH:mm:ss')
				}
			});

			return await this._screenshotService.create({
				timeSlotId: record.id,
				fullUrl,
				thumbUrl,
				recordedAt
			});
		} catch (error) {
			throw new BadRequestException(
				'Cant create screenshot for time slot'
			);
		}
	}
}
