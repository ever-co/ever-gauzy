import { ChangeDetectionStrategy, Component } from '@angular/core';
import { combineLatest, map, Observable } from 'rxjs';
import { VideoQuery } from '../../+state/video.query';
import { IVideo } from '../../shared/models/video.model';
import { IActionButton } from '../../shared/models/action-button.model';

@Component({
	selector: 'plug-video',
	templateUrl: './video.component.html',
	styleUrl: './video.component.scss',
	changeDetection: ChangeDetectionStrategy.OnPush
})
export class VideoComponent {
	public readonly downloadButton: IActionButton = {
		label: 'Download',
		icon: 'download-outline',
		status: 'primary',
		hidden: false,
		disabled: false,
		action: (video: IVideo) => {
			console.log(video);
		}
	};

	public readonly buttons: IActionButton[] = [
		{
			label: 'Edit',
			icon: 'edit-outline',
			status: 'primary',
			hidden: false,
			disabled: false,
			action: (video: IVideo) => {
				console.log(video);
			}
		},
		{
			label: 'Share',
			icon: 'share-outline',
			status: 'success',
			hidden: false,
			disabled: false,
			action: (video: IVideo) => {
				console.log(video);
			}
		},
		{
			label: 'Delete',
			icon: 'trash-2-outline',
			status: 'danger',
			hidden: false,
			disabled: false,
			action: (video: IVideo) => {
				console.log(video);
			}
		}
	];

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
