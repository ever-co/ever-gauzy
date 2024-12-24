import { IVideo } from '@gauzy/contracts';
import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { VideosService } from '../../services/videos.service';
import { GetVideoQuery } from '../get-video.query';

@QueryHandler(GetVideoQuery)
export class GetVideoQueryHandler implements IQueryHandler<GetVideoQuery> {
	constructor(private readonly videosService: VideosService) {}

	public async execute(query: GetVideoQuery): Promise<IVideo> {
		const { id, options = {} } = query;
		// Fetch video
		return this.videosService.findOneByIdString(id, options);
	}
}
