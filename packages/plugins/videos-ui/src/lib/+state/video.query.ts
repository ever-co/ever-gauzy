import { Injectable } from '@angular/core';
import { Query } from '@datorama/akita';
import { Observable } from 'rxjs';
import { IVideo } from '../shared/models/video.model';
import { IVideoState, VideoStore } from './video.store';

@Injectable({ providedIn: 'root' })
export class VideoQuery extends Query<IVideoState> {
	public readonly videos$: Observable<IVideo[]> = this.select((state) => state.videos);
	public readonly video$: Observable<IVideo | null> = this.select((state) => state.video);
	public readonly count$: Observable<number> = this.select((state) => state.count);
	public readonly isLoading$: Observable<boolean> = this.selectLoading();
	public readonly isAvailable$: Observable<boolean> = this.select((state) => state.count > 0);

	constructor(readonly videoStore: VideoStore) {
		super(videoStore);
	}

	public get video(): IVideo | null {
		return this.getValue().video;
	}

	public get videos(): IVideo[] {
		return this.getValue().videos || [];
	}

	public get count(): number {
		return this.getValue().count || 0;
	}
}
