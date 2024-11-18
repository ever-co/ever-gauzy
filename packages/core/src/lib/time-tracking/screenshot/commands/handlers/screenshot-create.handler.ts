import { CommandBus, CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { BadRequestException } from '@nestjs/common';
import { Between } from 'typeorm';
import moment from 'moment';
import { ITimeSlot } from '@gauzy/contracts';
import { TimeSlotCreateCommand } from './../../../time-slot/commands';
import { ScreenshotCreateCommand } from './../screenshot-create.command';
import { ScreenshotService } from './../../../screenshot/screenshot.service';
import { TimeSlotService } from './../../../time-slot/time-slot.service';
import { RequestContext } from './../../../../core/context';

@CommandHandler(ScreenshotCreateCommand)
export class ScreenshotCreateHandler implements ICommandHandler<ScreenshotCreateCommand> {
	constructor(
		private readonly _screenshotService: ScreenshotService,
		private readonly _timeSlotService: TimeSlotService,
		private readonly _commandBus: CommandBus
	) {}

	/**
	 * Handles the creation of a screenshot and associates it with a time slot.
	 * If a time slot does not exist for the given timestamp, a new time slot is created.
	 *
	 * @param {ScreenshotCreateCommand} command - The command containing the data required for screenshot creation.
	 * @returns {Promise<any>} - The created screenshot entity or an error if the process fails.
	 * @throws {BadRequestException} - Throws an exception if screenshot creation fails.
	 */
	public async execute(command: ScreenshotCreateCommand): Promise<any> {
		try {
			const { input } = command;
			const { file, thumb, recordedAt, activityTimestamp, employeeId, organizationId } = input;
			const tenantId = RequestContext.currentTenantId();

			const startedAt = moment(moment.utc(activityTimestamp).format('YYYY-MM-DD HH:mm:ss')).toDate();
			const stoppedAt = moment(
				moment.utc(activityTimestamp).add(10, 'minutes').format('YYYY-MM-DD HH:mm:ss')
			).toDate();

			let timeSlot: ITimeSlot;
			try {
				timeSlot = await this._timeSlotService.findOneByWhereOptions({
					employeeId,
					organizationId,
					tenantId,
					startedAt: Between<Date>(startedAt, stoppedAt)
				});
			} catch (error) {
				timeSlot = await this._commandBus.execute(
					new TimeSlotCreateCommand({
						tenantId,
						organizationId,
						employeeId,
						duration: 0,
						keyboard: 0,
						mouse: 0,
						overall: 0,
						startedAt: new Date(moment.utc(activityTimestamp).format()),
						time_slot: new Date(moment.utc(activityTimestamp).format())
					})
				);
			}
			return await this._screenshotService.create({
				timeSlot,
				file,
				thumb,
				recordedAt,
				organizationId,
				tenantId
			});
		} catch (error) {
			throw new BadRequestException(error, `Unable to create screenshot for the specified time slot.`);
		}
	}
}
