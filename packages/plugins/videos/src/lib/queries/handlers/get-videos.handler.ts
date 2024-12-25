import { IPagination } from '@gauzy/contracts';
import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { IVideo } from '../../video.model';
import { VideosService } from '../../services/videos.service';
import { GetVideosQuery } from '../get-videos.query';

@QueryHandler(GetVideosQuery)
export class GetVideosQueryHandler implements IQueryHandler<GetVideosQuery> {
	constructor(private readonly videosService: VideosService) {}

	/**
	 * Handles the `GetVideosQuery` to retrieve a paginated list of video entities.
	 *
	 * @param query - The `GetVideosQuery` containing parameters for pagination and filtering.
	 *
	 * @returns A promise resolving to a paginated result (`IPagination<IVideo>`), including a list of videos and metadata.
	 */
	public async execute(query: GetVideosQuery): Promise<IPagination<IVideo>> {
		// Extract pagination and filter parameters from the query
		const { params } = query;

		// Step 1: Fetch the paginated list of videos from the database
		return this.videosService.paginate(params);
	}
}
