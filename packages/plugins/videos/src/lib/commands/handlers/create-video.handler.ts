import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { IVideo } from '../../video.model';
import { Video } from '../../entities/video.entity';
import { VideosService } from '../../services/videos.service';
import { CreateVideoCommand } from '../create-video.command';

@CommandHandler(CreateVideoCommand)
export class CreateVideoHandler implements ICommandHandler<CreateVideoCommand> {
	constructor(private readonly videosService: VideosService) {}

	/**
	 * Handles the `CreateVideoCommand` to create a new video entity in the database.
	 *
	 * @param command - The `CreateVideoCommand` containing the input data for the new video.
	 *
	 * @returns A promise resolving to the newly created video entity (`IVideo`).
	 */
	public async execute(command: CreateVideoCommand): Promise<IVideo> {
		// Extract input data from the command
		const { input } = command;

		// Step 1: Create a new video entity with the provided input
		const video = new Video({
			...input,
			file: input.file.key // Extract the file key if a file object is provided
		});

		// Step 2: Save the new video entity to the database
		return this.videosService.create(video);
	}
}
