import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { RecoverSoundshotCommand } from '../recover-soundshot.command';
import { SoundshotService } from '../../services/soundshot.service';
import { NotFoundException } from '@nestjs/common';
import { ISoundshot } from '../../models/soundshot.model';

@CommandHandler(RecoverSoundshotCommand)
export class RecoverSoundshotCommandHandler implements ICommandHandler<RecoverSoundshotCommand> {
	constructor(private readonly soundshotService: SoundshotService) {}

	public async execute(command: RecoverSoundshotCommand): Promise<ISoundshot> {
		const { id } = command;
		const recovered = await this.soundshotService.softRecover(id, {
			withDeleted: true
		});

		if (!recovered) {
			throw new NotFoundException(`Soundshot with ${id} cannot be recovered`);
		}

		return recovered;
	}
}
