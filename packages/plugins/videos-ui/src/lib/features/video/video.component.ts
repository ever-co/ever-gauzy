import { ChangeDetectionStrategy, Component } from '@angular/core';
import { DeleteConfirmationComponent } from '@gauzy/ui-core/shared';
import { NbDialogService } from '@nebular/theme';
import { Actions } from '@ngneat/effects-ng';
import { combineLatest, filter, map, Observable, tap } from 'rxjs';
import { VideoActions } from '../../+state/video.action';
import { VideoQuery } from '../../+state/video.query';
import { IActionButton } from '../../shared/models/action-button.model';
import { IVideo } from '../../shared/models/video.model';
import { VideoEditComponent } from '../../shared/ui/video-edit/video-edit.component';
import { VideoMetadataComponent } from '../../shared/ui/video-metadata/video-metadata.component';
import { VideoShareComponent } from '../../shared/ui/video-share/video-share.component';

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
			action: this.edit.bind(this)
		},
		{
			label: 'Get Info',
			icon: 'settings-2-outline',
			status: 'info',
			hidden: false,
			disabled: false,
			action: this.metadata.bind(this)
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
		private readonly videoQuery: VideoQuery,
		private readonly dialogService: NbDialogService,
		private readonly actions: Actions
	) {}

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

	public edit(video: IVideo): void {
		this.dialogService
			.open(VideoEditComponent, { hasBackdrop: true, context: { video } })
			.onClose.pipe(
				filter(Boolean),
				tap((update: Partial<IVideo>) => this.actions.dispatch(VideoActions.updateVideo(video.id, update)))
			)
			.subscribe();
	}

	public metadata(video: IVideo): void {
		this.dialogService.open(VideoMetadataComponent, { hasBackdrop: true, context: { video } });
	}

	public share(video: IVideo): void {
		this.dialogService.open(VideoShareComponent, { hasBackdrop: true, context: { video } });
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
				filter(Boolean),
				tap(() => this.actions.dispatch(VideoActions.deleteVideo(video.id)))
			)
			.subscribe();
	}
}
