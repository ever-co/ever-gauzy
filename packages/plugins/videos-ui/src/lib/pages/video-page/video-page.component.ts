import { ChangeDetectionStrategy, Component, OnDestroy, OnInit } from '@angular/core';
import { Actions } from '@ngneat/effects-ng';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { distinctUntilChanged, map, tap } from 'rxjs';
import { VideoActions } from '../../+state/video.action';
import { VideoQuery } from '../../+state/video.query';
import { VideoStore } from '../../+state/video.store';

@UntilDestroy({ checkProperties: true })
@Component({
	selector: 'lib-video-page',
	templateUrl: './video-page.component.html',
	styleUrl: './video-page.component.scss',
	changeDetection: ChangeDetectionStrategy.OnPush
})
export class VideoPageComponent implements OnInit, OnDestroy {
	private skip = 0;
	private hasNext = false;
	private readonly take = 10;

	constructor(
		private readonly actions: Actions,
		private readonly videoQuery: VideoQuery,
		private readonly videoStore: VideoStore
	) {}

	ngOnInit() {
		this.videoQuery
			.select()
			.pipe(
				map(({ count }) => count > this.skip * this.take),
				distinctUntilChanged(),
				tap((hasNext) => (this.hasNext = hasNext)),
				untilDestroyed(this)
			)
			.subscribe();
	}

	public fetchVideos(): void {
		this.actions.dispatch(
			VideoActions.fetchVideos({
				skip: this.skip,
				take: this.take,
				relations: ['uploadedBy', 'uploadedBy.user'],
				order: { recordedAt: 'DESC' }
			})
		);
	}

	public fetchMoreVideos(): void {
		if (this.hasNext) {
			this.skip++;
			this.fetchVideos();
		}
	}

	public reset(): void {
		this.skip = 0;
		this.hasNext = false;
		this.videoStore.update({ videos: [] });
	}

	ngOnDestroy() {
		this.reset();
	}
}
