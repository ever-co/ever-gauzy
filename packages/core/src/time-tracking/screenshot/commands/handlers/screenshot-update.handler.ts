import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { BadRequestException } from '@nestjs/common';
import { ScreenshotUpdateCommand } from './../screenshot-update.command';
import { ScreenshotService } from './../../../screenshot/screenshot.service';

@CommandHandler(ScreenshotUpdateCommand)
export class ScreenshotUpdateHandler
	implements ICommandHandler<ScreenshotUpdateCommand> {

	constructor(
		private readonly _screenshotService: ScreenshotService
	) {}

	public async execute(command: ScreenshotUpdateCommand): Promise<any> {
		try {
			const { input } = command;
			const { id, file, thumb } = input;

			await this._screenshotService.update(id, {
				file,
				thumb
			});
			return await this._screenshotService.findOneByIdString(id);
		} catch (error) {
			throw new BadRequestException('Can\'t update screenshot for time slot');
		}
	}
}
