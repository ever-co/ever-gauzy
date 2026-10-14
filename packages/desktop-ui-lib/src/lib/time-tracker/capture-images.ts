/** One captured display: the image the timer uploads, and which display it came from. */
export interface ICapturedImage {
	img: Buffer;
	name: string;
	id: string;
}

/**
 * The captured displays that actually have an image. Electron's desktopCapturer returns an EMPTY image for a
 * display it cannot capture (a virtual or disconnected screen, a locked session); uploading it stores a 0-byte
 * file and creates no screenshot, so it is dropped here, and `onSkip` is told which display it was.
 */
export function withoutEmptyImages<T extends ICapturedImage>(images: T[], onSkip?: (image: T) => void): T[] {
	return (images ?? []).filter((image) => {
		if (image?.img?.length) return true;
		onSkip?.(image);
		return false;
	});
}
