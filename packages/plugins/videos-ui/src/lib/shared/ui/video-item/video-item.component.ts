import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { DeleteConfirmationComponent } from '@gauzy/ui-core/shared';
import { NbDialogService } from '@nebular/theme';
import { Actions } from '@ngneat/effects-ng';
import { filter, take, tap } from 'rxjs';
import { VideoActions } from '../../../+state/video.action';
import { IActionButton } from '../../models/action-button.model';
import { IVideo } from '../../models/video.model';

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
			action: this.open.bind(this)
		},
		{
			label: 'Download',
			icon: 'download-outline',
			status: 'primary',
			hidden: false,
			disabled: false,
			action: this.download.bind(this)
		},
		{
			label: 'Share',
			icon: 'share-outline',
			status: 'success',
			hidden: false,
			disabled: false,
			action: this.share.bind(this)
		},
		{
			label: 'Delete',
			icon: 'trash-2-outline',
			status: 'danger',
			hidden: false,
			disabled: false,
			action: this.delete.bind(this)
		}
	];

	constructor(
		private readonly router: Router,
		private readonly route: ActivatedRoute,
		private readonly actions: Actions,
		private readonly dialogService: NbDialogService
	) {}

	public async open({ id }: IVideo): Promise<void> {
		const { reuseRoute } = this.route.snapshot.data;
		await this.router.navigate(reuseRoute ? ['..', id] : [id], { relativeTo: this.route });
	}

	public share(video: IVideo): void {
		this.actions.dispatch(
			VideoActions.shareVideos({
				title: video.title,
				text: video.description,
				fileUrls: [video.fullUrl]
			})
		);
	}

	public delete(video: IVideo): void {
		this.dialogService
			.open(DeleteConfirmationComponent, {
				hasBackdrop: true,
				context: {
					recordType: 'video',
					isRecord: false
				}
			})
			.onClose.pipe(
				take(1),
				filter(Boolean),
				tap(() => this.actions.dispatch(VideoActions.deleteVideo(video.id)))
			)
			.subscribe();
	}

	public download({ fullUrl }: IVideo): void {
		this.actions.dispatch(VideoActions.addToQueue(fullUrl));
	}
}
