import { IVideo } from '@gauzy/contracts';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Video } from '../../entities/video.entity';
import { VideosService } from '../../services/videos.service';
import { CreateVideoCommand } from '../create-video.command';

@CommandHandler(CreateVideoCommand)
export class CreateVideoHandler implements ICommandHandler<CreateVideoCommand> {
	constructor(private readonly videosService: VideosService) {}

	/**
	 * Handles the CreateVideoCommand.
	 */
	public async execute(command: CreateVideoCommand): Promise<IVideo> {
		const { input } = command;

		// Instantiate new video entity
		const video = new Video({
			...input,
			file: input.file.key
		});

		// Create video
		return this.videosService.create(video);
	}
}
