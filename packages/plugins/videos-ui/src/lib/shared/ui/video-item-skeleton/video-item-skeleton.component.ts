import { ChangeDetectionStrategy, Component } from '@angular/core';

@Component({
	selector: 'plug-video-item-skeleton',
	templateUrl: './video-item-skeleton.component.html',
	styleUrl: './video-item-skeleton.component.scss',
	standalone: false,
	changeDetection: ChangeDetectionStrategy.OnPush
})
export class VideoItemSkeletonComponent {}
