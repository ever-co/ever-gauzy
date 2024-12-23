import { IPagination, IVideo } from '@gauzy/contracts';
import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { VideosService } from '../../services/videos.service';
import { GetVideosQuery } from '../get-videos.query';

@QueryHandler(GetVideosQuery)
export class GetVideosQueryHandler implements IQueryHandler<GetVideosQuery> {
	constructor(private readonly videosService: VideosService) {}

	public async execute(query: GetVideosQuery): Promise<IPagination<IVideo>> {
		const { params } = query;
		// Fetch videos with pagination
		return this.videosService.paginate(params);
	}
}
