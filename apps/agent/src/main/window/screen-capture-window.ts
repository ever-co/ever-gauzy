import { ScreenCaptureNotification } from '@gauzy/desktop-window';
export class ScreenCaptureWindow extends ScreenCaptureNotification {
	private showNotification: (thumbUrl?: string) => void;
	private hideNotification?: () => void;
	constructor(
		path: string,
		preloadPath: string,
		showNotification: (thumbUrl?: string) => void,
		hideNotification?: () => void
	) {
		super(path, preloadPath);
		this.showNotification = showNotification;
		this.hideNotification = hideNotification;
	}
	override show(thumbUrl?: string): void {
		this.showNotification(thumbUrl);
	}

	override hide(): void {
	    console.warn('Prevent this method to directly call');
	}

	/**
	 * The notification's close button (#7643): the window manager closes it, so that its own auto-hide timeout is
	 * cancelled with it and cannot close the next notification early.
	 */
	override hideNow(): void {
		if (this.hideNotification) {
			this.hideNotification();
			return;
		}
		super.hideNow();
	}
}
