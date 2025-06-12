import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Soundshot } from '../../entity/soundshot.entity';
import { ISoundshot } from '../../models/soundshot.model';
import { SoundshotService } from '../../services/soundshot.service';
import { SoundshotFactory } from '../../shared/soundshot.factory';
import { CreateSoundshotCommand } from '../create-soundshot.command';

@CommandHandler(CreateSoundshotCommand)
export class CreateSoundshotCommandHandler implements ICommandHandler<CreateSoundshotCommand> {
	constructor(private readonly soundshotService: SoundshotService) {}

	public async execute(command: CreateSoundshotCommand): Promise<ISoundshot> {
		// Extract the input and file from the command
		const { input, file } = command;
		// Prepare the file
		try {
			const { storageProvider } = await this.soundshotService.prepare(file);
			// Create the soundshot record
			const soundshot = Object.assign(new Soundshot(), SoundshotFactory.create(input), {
				fileKey: file.key,
				storageProvider
			});

			// Create the soundshot record
			return this.soundshotService.create(soundshot);
		} catch (error) {
			// Ensure cleanup of uploaded file if preparation failed
			if (file?.key) {
				const provider = this.soundshotService.getFileStorageProviderInstance();
				await provider.deleteFile(file.key);
			}
			throw error;
		}
	}
}
