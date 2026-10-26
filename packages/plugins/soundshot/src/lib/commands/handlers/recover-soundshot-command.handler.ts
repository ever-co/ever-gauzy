import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { RecoverSoundshotCommand } from '../recover-soundshot.command';
import { SoundshotService } from '../../services/soundshot.service';
import { NotFoundException } from '@nestjs/common';
import { assertCallerOwnsUpload } from '@gauzy/core';
import { ISoundshot } from '../../models/soundshot.model';

@CommandHandler(RecoverSoundshotCommand)
export class RecoverSoundshotCommandHandler implements ICommandHandler<RecoverSoundshotCommand> {
	constructor(private readonly soundshotService: SoundshotService) {}

	public async execute(command: RecoverSoundshotCommand): Promise<ISoundshot> {
		const { id } = command;
		// An unknown id is left to softRecover; another employee's soundshot gets the same 404 it gives one.
		// Any other lookup failure stops the restore instead of skipping the ownership check.
		const soundshot = await this.soundshotService
			.findOneByIdString(id, { withDeleted: true })
			.catch((error) => (error instanceof NotFoundException ? null : Promise.reject(error)));
		if (soundshot) {
			assertCallerOwnsUpload(
				soundshot,
				'An error occurred during restoring entity: The requested record was not found'
			);
		}
		const recovered = await this.soundshotService.softRecover(id, {
			withDeleted: true
		});

		if (!recovered) {
			throw new NotFoundException(`Soundshot with ${id} cannot be recovered`);
		}

		return recovered;
	}
}
