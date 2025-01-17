import { ChangeDetectionStrategy, Component, OnInit } from '@angular/core';
import { Actions } from '@ngneat/effects-ng';
import { Observable, combineLatest, map } from 'rxjs';
import { VideoQuery } from '../../+state/video.query';
import { IVideo } from '../../shared/models/video.model';
import { VideoActions } from '../../+state/video.action';

@Component({
	selector: 'lib-video-page',
	templateUrl: './video-page.component.html',
	styleUrl: './video-page.component.scss',
	changeDetection: ChangeDetectionStrategy.OnPush
})
export class VideoPageComponent implements OnInit {
	constructor(private readonly actions: Actions) {}

	ngOnInit() {
		this.actions.dispatch(
			VideoActions.fetchVideos({
				relations: ['uploadedBy', 'uploadedBy.user'],
				order: { recordedAt: 'DESC' }
			})
		);
	}
}
