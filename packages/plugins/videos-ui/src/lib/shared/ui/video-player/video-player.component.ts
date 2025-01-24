import { ChangeDetectionStrategy, Component, ElementRef, Input, ViewChild } from '@angular/core';
import { DomSanitizer, SafeUrl } from '@angular/platform-browser';

@Component({
	selector: 'plug-video-player',
	templateUrl: './video-player.component.html',
	styleUrl: './video-player.component.scss',
	changeDetection: ChangeDetectionStrategy.OnPush
})
export class VideoPlayerComponent {
	private _src!: string;
	@ViewChild('video')
	private video!: ElementRef<HTMLVideoElement>;
	@Input()
	public controls = false;

	constructor(private readonly sanitizer: DomSanitizer) {}

	public get player(): HTMLVideoElement {
		return this.video.nativeElement;
	}

	public get src(): SafeUrl {
		return this.sanitizer.bypassSecurityTrustUrl(this._src);
	}

	@Input()
	public set src(value: string) {
		this._src = value;
	}
}
