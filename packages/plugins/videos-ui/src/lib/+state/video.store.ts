import { Injectable } from '@angular/core';
import { Store, StoreConfig } from '@datorama/akita';
import { IVideo } from '../shared/models/video.model';

export interface IVideoState {
	count: number;
	videos: IVideo[];
	video: IVideo | null;
}

export function createInitialState(): IVideoState {
	return {
		videos: [],
		video: null,
		count: 0
	};
}

@StoreConfig({ name: 'video' })
@Injectable({ providedIn: 'root' })
export class VideoStore extends Store<IVideoState> {
	constructor() {
		super(createInitialState());
	}
}
