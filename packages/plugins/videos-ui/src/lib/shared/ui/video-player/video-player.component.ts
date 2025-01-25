import { ChangeDetectionStrategy, Component, ElementRef, Input, ViewChild } from '@angular/core';
import { DomSanitizer, SafeUrl } from '@angular/platform-browser';
@Component({
	selector: 'plug-video-player',
	templateUrl: './video-player.component.html',
	styleUrl: './video-player.component.scss',
	changeDetection: ChangeDetectionStrategy.OnPush
})
export class VideoPlayerComponent {
	/**
	 * The video source URL.
	 */
	private _src!: string;
	public get src(): SafeUrl {
		return this.sanitizer.bypassSecurityTrustUrl(this._src);
	}
	@Input() public set src(value: string) {
		this._src = value;
	}

	@Input() public controls = false;
	@Input() alt: string = '';

	// Video element
	@ViewChild('video') private video!: ElementRef<HTMLVideoElement>;

	/**
	 * The video player element.
	 */
	public get player(): HTMLVideoElement {
		if (!this.video?.nativeElement) {
			throw new Error('Video element not initialized');
		}
		return this.video.nativeElement;
	}

	constructor(private readonly sanitizer: DomSanitizer) {}
}
