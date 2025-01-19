import { AfterViewInit, ChangeDetectionStrategy, Component, ElementRef, OnInit, ViewChild } from '@angular/core';
import { ActivatedRoute, NavigationEnd, Router } from '@angular/router';
import { Actions } from '@ngneat/effects-ng';
import { VideoActions } from '../../+state/video.action';

@Component({
	selector: 'lib-video-detail-page',
	templateUrl: './video-detail-page.component.html',
	styleUrl: './video-detail-page.component.scss',
	changeDetection: ChangeDetectionStrategy.OnPush
})
export class VideoDetailPageComponent implements OnInit, AfterViewInit {
	@ViewChild('detail') card!: ElementRef;

	constructor(
		private readonly actions: Actions,
		private readonly route: ActivatedRoute,
		private readonly router: Router
	) {}

	ngOnInit() {
		this.route.params.subscribe(({ id }) => {
			this.actions.dispatch(
				VideoActions.fetchOneVideo(id, {
					relations: ['uploadedBy', 'uploadedBy.user']
				})
			);
		});
	}

	ngAfterViewInit() {
		this.router.events.subscribe((evt) => {
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
			}
		});
	}
}
