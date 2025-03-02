import { ChangeDetectionStrategy, Component } from '@angular/core';
import { NbDialogRef } from '@nebular/theme';
import { IVideo } from '../../models/video.model';

@Component({
	selector: 'lib-video-metadata',
	templateUrl: './video-metadata.component.html',
	styleUrl: './video-metadata.component.scss',
	changeDetection: ChangeDetectionStrategy.OnPush
})
export class VideoMetadataComponent {
	public video!: IVideo;

	constructor(protected dialogRef: NbDialogRef<VideoMetadataComponent>) {}

	public close(): void {
		this.dialogRef.close();
	}
}
