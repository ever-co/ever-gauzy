import { ChangeDetectionStrategy, Component } from '@angular/core';

@Component({
	selector: 'plug-video-skeleton',
	templateUrl: './video-skeleton.component.html',
	styleUrl: './video-skeleton.component.scss',
	standalone: false,
	changeDetection: ChangeDetectionStrategy.OnPush
})
export class VideoSkeletonComponent {}
