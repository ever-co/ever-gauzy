import { IVideo } from '@gauzy/contracts';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { VideosService } from '../../services/videos.service';
import { UpdateVideoCommand } from '../update-video.command';

@CommandHandler(UpdateVideoCommand)
export class UpdateVideoHandler implements ICommandHandler<UpdateVideoCommand> {
	constructor(public readonly videosService: VideosService) {}
	// Execute update video command
	public async execute(command: UpdateVideoCommand): Promise<IVideo> {
		const { input } = command;
		// Destructure input
		const { id, title, size, file, duration } = input;
		// Update video
		await this.videosService.update(id, { title, size, duration, file: file.key });
		// Fetch and return the updated video entity
		return this.videosService.findOneByIdString(id);
	}
}
