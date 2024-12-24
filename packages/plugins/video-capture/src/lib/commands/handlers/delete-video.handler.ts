import { NotFoundException } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { DeleteResult } from 'typeorm';
import { VideosService } from '../../services/videos.service';
import { DeleteVideoCommand } from '../delete-video.command';

@CommandHandler(DeleteVideoCommand)
export class DeleteVideoHandler implements ICommandHandler<DeleteVideoCommand> {
	constructor(private readonly videosService: VideosService) {}

	/**
	 * Handles the DeleteVideoCommand.
	 */
	public async execute(command: DeleteVideoCommand): Promise<DeleteResult> {
		const {
			input: { id, options = {} }
		} = command;

		// Check if the video exists
		const video = await this.videosService.findOneByWhereOptions({ id, ...options });

		// If the video does not exist, throw an error
		if (!video) {
			throw new NotFoundException(`Video with ID ${id} not found.`);
		}

		// Remove video
		return this.videosService.delete(id, {
			where: options
		});
	}
}
