import { ChangeDetectionStrategy, Component } from '@angular/core';
import { IVideo } from '../../models/video.model';
import { NbDialogRef } from '@nebular/theme';

@Component({
	selector: 'lib-video-share',
	templateUrl: './video-share.component.html',
	styleUrl: './video-share.component.scss',
	changeDetection: ChangeDetectionStrategy.OnPush
})
export class VideoShareComponent {
	public video!: IVideo;

	constructor(protected dialogRef: NbDialogRef<VideoShareComponent>) {}

	public close(): void {
		this.dialogRef.close();
	}
}
