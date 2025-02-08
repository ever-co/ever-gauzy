import { GetVideoCountQueryHandler } from './get-video-count.handler';
import { GetVideoQueryHandler } from './get-video.handler';
import { GetVideosQueryHandler } from './get-videos.handler';

export const QueryHandlers = [GetVideoQueryHandler, GetVideosQueryHandler, GetVideoCountQueryHandler];
