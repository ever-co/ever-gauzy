import { ScreenCaptureNotification } from '@gauzy/desktop-window';
export class ScreenCaptureWiindow extends ScreenCaptureNotification {
	private showNotification: (thumbUrl: string) => void;
	constructor(
		path: string,
		preloadPath: string,
		showNotification: (thumbUrl?: string) => void
	) {
		super(path, preloadPath);
		this.showNotification = showNotification;
	}
	override show(thumbUrl?: string): void {
		this.showNotification(thumbUrl);
	}

	override hide(): void {
	    console.warn('Prevent this method to directly call');
	}
}
