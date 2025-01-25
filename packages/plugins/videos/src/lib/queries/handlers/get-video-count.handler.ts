import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { VideosService } from '../../services/videos.service';
import { GetVideoCountQuery } from '../get-video-count.query';

@QueryHandler(GetVideoCountQuery)
export class GetVideoCountQueryHandler implements IQueryHandler<GetVideoCountQuery> {
	constructor(private readonly videosService: VideosService) {}

	/**
	 * Handles the `GetVideoCountQuery` to retrieve the count of video entities.
	 *
	 * @param query - The `GetVideoCountQuery` containing the ID of the video to be fetched and optional query options.
	 *
	 * @returns A promise resolving to the count of video entities (`number`).
	 *
	 */
	public async execute(query: GetVideoCountQuery): Promise<number> {
		// Destructure the query to extract the video ID and options
		const { options } = query || {};
		// Fetch the video entity from the database
		const { organizationId, tenantId } = options;
		// Fetch the count of video entities from the database
		return this.videosService.count({
			where: {
				organizationId,
				tenantId
			}
		});
	}
}
