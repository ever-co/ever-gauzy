import { ChangeDetectionStrategy, Component, Input } from '@angular/core';

@Component({
	selector: 'plug-video-player',
	templateUrl: './video-player.component.html',
	styleUrl: './video-player.component.scss',
	changeDetection: ChangeDetectionStrategy.OnPush
})
export class VideoPlayerComponent {
	@Input() src!: string;
	@Input() controls = false;
}
