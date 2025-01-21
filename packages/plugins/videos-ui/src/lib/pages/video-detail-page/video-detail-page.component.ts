import {
	AfterViewInit,
	ChangeDetectionStrategy,
	Component,
	ElementRef,
	OnDestroy,
	OnInit,
	ViewChild
} from '@angular/core';
import { ActivatedRoute, NavigationEnd, Router } from '@angular/router';
import { Actions } from '@ngneat/effects-ng';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { distinctUntilChanged, map, tap } from 'rxjs';
import { VideoActions } from '../../+state/video.action';
import { VideoQuery } from '../../+state/video.query';
import { VideoStore } from '../../+state/video.store';

@UntilDestroy({ checkProperties: true })
@Component({
	selector: 'lib-video-detail-page',
	templateUrl: './video-detail-page.component.html',
	styleUrl: './video-detail-page.component.scss',
	changeDetection: ChangeDetectionStrategy.OnPush
})
export class VideoDetailPageComponent implements OnInit, AfterViewInit, OnDestroy {
	@ViewChild('detail') card!: ElementRef;
	private skip = 0;
	private hasNext = false;
	private readonly take = 10;

	constructor(
		private readonly actions: Actions,
		private readonly route: ActivatedRoute,
		private readonly router: Router,
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
		this.route.params
			.pipe(
				tap(({ id }) => {
					this.actions.dispatch(
						VideoActions.fetchOneVideo(id, {
							relations: ['uploadedBy', 'uploadedBy.user']
						})
					);
				}),
				untilDestroyed(this)
			)
			.subscribe();
	}

	ngAfterViewInit() {
		this.router.events
			.pipe(
				tap((evt) => {
					if (evt instanceof NavigationEnd) {
						// Check if there's a card
						if (!this.card) {
							return;
						}
						// trick the Router into believing it's last link wasn't previously loaded
						this.router.navigated = false;
						// Get element
						const element = this.card.nativeElement;
						// Check if it exists
						if (!element) {
							return;
						}
						// Scroll back to top
						element.scroll({ top: 0, behavior: 'smooth' });
						// Reset skip
						this.skip = 1;
						// fetch videos
						this.fetchVideos();
					}
				}),
				untilDestroyed(this)
			)
			.subscribe();
	}

	public fetchVideos(): void {
		this.actions.dispatch(
			VideoActions.fetchVideosAndExclude(this.route.snapshot.params['id'], {
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
