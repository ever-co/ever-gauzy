import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { IVideo } from '../../video.model';
import { VideosService } from '../../services/videos.service';
import { UpdateVideoCommand } from '../update-video.command';

@CommandHandler(UpdateVideoCommand)
export class UpdateVideoHandler implements ICommandHandler<UpdateVideoCommand> {
	constructor(public readonly videosService: VideosService) {}

	/**
	 * Handles the update of a video entity in the database.
	 * This method receives an `UpdateVideoCommand`, updates the video entity with the provided data,
	 * and returns the updated video entity.
	 *
	 * @param command - The command containing the input data for updating the video.
	 *
	 * @returns A promise that resolves to the updated video entity (`IVideo`).
	 */
	public async execute(command: UpdateVideoCommand): Promise<IVideo> {
		// Extract input data from the command
		const { input, id } = command;

		// Destructure the input fields for clarity
		const { title, description } = input;

		// Update the video entity in the database using the provided ID and input fields
		await this.videosService.update(id, {
			title,
			description
		});

		// Fetch and return the updated video entity by its ID
		return this.videosService.findOneByIdString(id);
	}
}
