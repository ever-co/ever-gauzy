import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { Observable, combineLatest, map } from 'rxjs';
import { VideoQuery } from '../../+state/video.query';
import { IVideo } from '../../shared/models/video.model';

@Component({
	selector: 'plug-video-list',
	templateUrl: './video-list.component.html',
	styleUrl: './video-list.component.scss',
	changeDetection: ChangeDetectionStrategy.OnPush
})
export class VideoListComponent {
	@Input() vertical = false;

	constructor(private readonly videoQuery: VideoQuery) {}

	public get videos$(): Observable<IVideo[]> {
		return this.videoQuery.videos$;
	}

	public get isAvailable$(): Observable<boolean> {
		return combineLatest([this.videoQuery.isAvailable$, this.isLoading$]).pipe(
			map(([isAvailable, isLoading]) => isAvailable && !isLoading)
		);
	}

	public get isLoading$(): Observable<boolean> {
		return this.videoQuery.isLoading$;
	}
}
