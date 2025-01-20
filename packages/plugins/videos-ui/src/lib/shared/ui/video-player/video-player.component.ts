import { ChangeDetectionStrategy, Component, ElementRef, Input, ViewChild } from '@angular/core';

@Component({
	selector: 'plug-video-player',
	templateUrl: './video-player.component.html',
	styleUrl: './video-player.component.scss',
	changeDetection: ChangeDetectionStrategy.OnPush
})
export class VideoPlayerComponent {
	@ViewChild('video')
	private video!: ElementRef<HTMLVideoElement>;
	@Input()
	public src!: string;
	@Input()
	public controls = false;

	public get player(): HTMLVideoElement {
		return this.video.nativeElement;
	}
}
