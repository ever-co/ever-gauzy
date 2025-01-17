import { ChangeDetectionStrategy, Component } from '@angular/core';
import { combineLatest, map, Observable } from 'rxjs';
import { VideoQuery } from '../../+state/video.query';
import { IVideo } from '../../shared/models/video.model';

@Component({
	selector: 'plug-video',
	templateUrl: './video.component.html',
	styleUrl: './video.component.scss',
	changeDetection: ChangeDetectionStrategy.OnPush
})
export class VideoComponent {
	constructor(private readonly videoQuery: VideoQuery) {}

	public get video$(): Observable<IVideo> {
		return this.videoQuery.video$;
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
