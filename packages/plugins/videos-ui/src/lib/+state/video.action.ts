import { createAction } from '@ngneat/effects';
import { IVideo } from '../shared/models/video.model';

export class VideoActions {
	public static fetchVideos = createAction('[Videos] Fetch Videos', (params?: any) => ({ params }));

	public static fetchOneVideo = createAction('[Videos] Fetch One Video', (id: string, params?: any) => ({
		id,
		params
	}));

	public static updateVideo = createAction('[Videos] Update Video', (id: string, video: Partial<IVideo>) => ({
		id,
		video
	}));

	public static deleteVideo = createAction('[Videos] Delete Video', (id: string) => ({ id }));
}
