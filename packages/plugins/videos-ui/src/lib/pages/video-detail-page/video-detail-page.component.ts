import { ChangeDetectionStrategy, Component, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { Actions } from '@ngneat/effects-ng';
import { VideoActions } from '../../+state/video.action';

@Component({
	selector: 'lib-video-detail-page',
	templateUrl: './video-detail-page.component.html',
	styleUrl: './video-detail-page.component.scss',
	changeDetection: ChangeDetectionStrategy.OnPush
})
export class VideoDetailPageComponent implements OnInit {
	constructor(private readonly actions: Actions, private readonly route: ActivatedRoute) {}

	ngOnInit() {
		this.route.params.subscribe(({ id }) => {
			this.actions.dispatch(
				VideoActions.fetchOneVideo(id, {
					relations: ['uploadedBy', 'uploadedBy.user']
				})
			);
		});
	}
}
