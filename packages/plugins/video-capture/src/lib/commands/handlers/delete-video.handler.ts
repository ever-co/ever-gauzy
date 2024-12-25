import { NotFoundException } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { DeleteResult } from 'typeorm';
import { VideosService } from '../../services/videos.service';
import { DeleteVideoCommand } from '../delete-video.command';

@CommandHandler(DeleteVideoCommand)
export class DeleteVideoHandler implements ICommandHandler<DeleteVideoCommand> {
	constructor(private readonly videosService: VideosService) {}

	/**
	 * Handles the `DeleteVideoCommand` to delete a video entity from the database.
	 * Validates the existence of the video and performs the deletion based on the provided criteria.
	 *
	 * @param command - The `DeleteVideoCommand` containing the video ID and additional options for deletion.
	 *
	 * @returns A promise resolving to a `DeleteResult`, which includes metadata about the deletion operation.
	 *
	 * @throws {NotFoundException} If the video with the specified ID does not exist.
	 */
	public async execute(command: DeleteVideoCommand): Promise<DeleteResult> {
		// Destructure the command to extract input data
		const {
			input: { id, options = {} }
		} = command;

		// Step 1: Check if the video exists
		const video = await this.videosService.findOneByWhereOptions({ ...options, id });

		// Step 2: Throw a NotFoundException if the video does not exist
		if (!video) {
			throw new NotFoundException(`Video with ID ${id} not found.`);
		}

		// Step 3: Delete the video entity from the database
		return this.videosService.delete(id, {
			where: options
		});
	}
}
