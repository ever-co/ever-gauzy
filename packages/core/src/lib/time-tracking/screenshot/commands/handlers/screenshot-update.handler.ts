import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { BadRequestException } from '@nestjs/common';
import { ScreenshotUpdateCommand } from '../screenshot-update.command';
import { ScreenshotService } from '../../../screenshot/screenshot.service';
import { Screenshot } from '../../screenshot.entity';

@CommandHandler(ScreenshotUpdateCommand)
export class ScreenshotUpdateHandler implements ICommandHandler<ScreenshotUpdateCommand> {
	constructor(private readonly _screenshotService: ScreenshotService) {}

	/**
	 * Handles the update of a screenshot entity.
	 *
	 * @param {ScreenshotUpdateCommand} command - The command containing the data required for screenshot update.
	 * @returns {Promise<any>} - The updated screenshot entity or an error if the process fails.
	 * @throws {BadRequestException} - Throws an exception if screenshot update fails.
	 */
	public async execute(command: ScreenshotUpdateCommand): Promise<Screenshot> {
		try {
			const { input } = command;
			const { id, file, thumb } = input;

			// Update the screenshot with the new file and thumbnail data
			await this._screenshotService.update(id, {
				file,
				thumb
			});

			// Fetch and return the updated screenshot entity
			return await this._screenshotService.findOneByIdString(id);
		} catch (error) {
			throw new BadRequestException('Unable to update screenshot for the specified time slot.', error);
		}
	}
}
