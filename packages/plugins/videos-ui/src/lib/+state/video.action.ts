import { createAction } from '@ngneat/effects';
import { IVideo } from '../shared/models/video.model';
import { IShareData } from '../shared/models/share-video.model';

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

	public static shareVideos = createAction('[Videos] Share Videos', (payload: IShareData) => ({ payload }));

	public static addToQueue = createAction('[Videos] Add to Queue', (urls: string[] | string) => ({
		urls
	}));

	public static removeFromQueue = createAction('[Videos] Remove from Queue', (url: string) => ({
		url
	}));

	public static retryDownload = createAction('[Videos] Retry Download', (url: string) => ({
		url
	}));
}
