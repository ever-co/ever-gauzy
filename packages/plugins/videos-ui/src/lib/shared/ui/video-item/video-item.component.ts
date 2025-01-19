import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { Router, ActivatedRoute } from '@angular/router';
import { IVideo } from '../../models/video.model';
import { IActionButton } from '../../models/action-button.model';

@Component({
	selector: 'plug-video-item',
	templateUrl: './video-item.component.html',
	styleUrl: './video-item.component.scss',
	changeDetection: ChangeDetectionStrategy.OnPush
})
export class VideoItemComponent {
	@Input({ required: true }) video!: IVideo;

	public readonly buttons: IActionButton[] = [
		{
			label: 'Watch',
			icon: 'eye-outline',
			status: 'basic',
			hidden: false,
			disabled: false,
			action: (video: IVideo) => {
				console.log(video);
			}
		},
		{
			label: 'Download',
			icon: 'download-outline',
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

	constructor(private readonly router: Router, private readonly route: ActivatedRoute) {}

	public async open({ id }: IVideo): Promise<void> {
		const { reuseRoute } = this.route.snapshot.data;
		await this.router.navigate(reuseRoute ? ['..', id] : [id], { relativeTo: this.route });
	}
}
