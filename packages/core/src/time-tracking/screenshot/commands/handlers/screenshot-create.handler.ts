import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { BadRequestException } from '@nestjs/common';
import * as moment from 'moment';
import { ScreenshotCreateCommand } from '..';
import { ScreenshotService } from './../../../screenshot/screenshot.service';
import { TimeSlotService } from './../../../time-slot/time-slot.service';

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
				employeeId,
				organizationId
			} = input;

			let {
				record: timeSlot
			} = await this._timeSlotService.findOneOrFailByOptions({
				where: {
					startedAt: new Date(
						moment(activityTimestamp).format('YYYY-MM-DD HH:mm:ss')
					)
				}
			});

			//if timeslot not found for this screenshot then create new timeslot
			if (!timeSlot) {
				timeSlot = await this._timeSlotService.create({
					employeeId,
					duration: 600,
					keyboard: 0,
					mouse: 0,
					overall: 0,
					startedAt: new Date(
						moment(activityTimestamp).format('YYYY-MM-DD HH:mm:ss')
					)
				});
			}

			const {
				record: screenshot
			} = await this._screenshotService.findOneOrFailByOptions({
				where: {
					timeSlotId: timeSlot
				}
			});

			if (screenshot) {
				const { id } = screenshot;
				await this._screenshotService.update(id, {
					file,
					thumb
				});
				return await this._screenshotService.findOne(id);
			}
			return await this._screenshotService.create({
				timeSlotId: timeSlot,
				file,
				thumb,
				recordedAt,
				organizationId
			});
		} catch (error) {
			throw new BadRequestException(
				'Cant create screenshot for time slot'
			);
		}
	}
}
