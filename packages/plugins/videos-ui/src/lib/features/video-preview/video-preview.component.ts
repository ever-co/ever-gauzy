import { ChangeDetectionStrategy, Component } from '@angular/core';

@Component({
	selector: 'plug-video-preview',
	templateUrl: './video-preview.component.html',
	styleUrl: './video-preview.component.scss',
	changeDetection: ChangeDetectionStrategy.OnPush
})
export class VideoPreviewComponent {}
