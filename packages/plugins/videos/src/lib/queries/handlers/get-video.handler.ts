import { NotFoundException } from '@nestjs/common';
import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { VideosService } from '../../services/videos.service';
import { IVideo } from '../../video.model';
import { GetVideoQuery } from '../get-video.query';

@QueryHandler(GetVideoQuery)
export class GetVideoQueryHandler implements IQueryHandler<GetVideoQuery> {
	constructor(private readonly videosService: VideosService) {}

	/**
	 * Handles the `GetVideoQuery` to retrieve a video entity by its ID.
	 *
	 * @param query - The `GetVideoQuery` containing the ID of the video to be fetched and optional query options.
	 *
	 * @returns A promise resolving to the video entity (`IVideo`) if found.
	 *
	 * @throws {NotFoundException} If the video with the specified ID is not found.
	 */
	public async execute(query: GetVideoQuery): Promise<IVideo> {
		// Destructure the query to extract the video ID and options
		const { id, options = {} } = query;

		// Step 1: Fetch the video entity from the database
		const video = await this.videosService.findOneByIdString(id, options);

		// Step 2: Throw a NotFoundException if the video does not exist
		if (!video) {
			throw new NotFoundException(`Video with ID ${id} not found.`);
		}

		// Step 3: Return the video entity
		return video;
	}
}
