import { Injectable, inject } from '@angular/core';
import { ElectronService } from './electron.service';

@Injectable({
	providedIn: 'root'
})
export class ScreenCaptureWebRTSService {
	// Cache the source id so we don't need to re-enumerate sources on every
	// screenshot — enumerating sources is cheap and doesn't itself prompt,
	// but no need to repeat it if the source list won't change mid-session.
	private readonly electronService: ElectronService = inject(ElectronService);
	private cachedSourceId: string | null = null;

	/**
	 * IPC handler entry point for 'take_screenshot'.
	 *
	 * Opens a short-lived getUserMedia stream, grabs exactly one frame via
	 * canvas, then immediately stops the stream. No stream is held open
	 * between screenshots — this relies on the portal/Chromium reusing the
	 * permission grant (restore token) instead of re-prompting.
	 *
	 * IMPORTANT: verify this actually avoids re-prompting on your target
	 * Electron version + Linux DE/compositor before relying on it. See the
	 * notes at the bottom of this file.
	 */
	async takeScreenshot(): Promise<string> {
		const sourceId = await this.getSourceId();

		const stream = await (navigator.mediaDevices as any).getUserMedia({
			audio: false,
			video: {
				mandatory: {
					chromeMediaSource: 'desktop',
					chromeMediaSourceId: sourceId,
					// No need for continuous high frame rate — we only want one frame.
					maxFrameRate: 5
				}
			}
		} as any);

		try {
			return await this.grabFrame(stream);
		} finally {
			// Always stop tracks, even if grabFrame throws, so we never leak
			// an open capture session.
			stream.getTracks().forEach((track) => track.stop());
		}
	}

	/**
	 * Returns the screen source id, using a cached value if we already have one.
	 * If your app lets the user pick a monitor, don't cache — re-fetch and let
	 * them choose each time instead.
	 */
	private async getSourceId(): Promise<string> {
		if (this.cachedSourceId) {
			return this.cachedSourceId;
		}

		// No thumbnailSize needed — we only want the source id, not an image.
		const sources = await this.electronService.desktopCapturer.getSources({ types: ['screen'] });

		if (!sources.length) {
			throw new Error('No screen sources available from desktopCapturer');
		}

		// If you support multi-monitor selection, let the user pick here instead
		// of always taking sources[0].
		this.cachedSourceId = sources[0].id;
		return this.cachedSourceId;
	}

	/**
	 * Attaches a stream to a detached <video>, waits for a frame to be
	 * available, draws it to an offscreen <canvas>, and returns the PNG data URL.
	 */
	private grabFrame(stream: MediaStream): Promise<string> {
		return new Promise((resolve, reject) => {
			const video = document.createElement('video');
			video.muted = true;
			video.srcObject = stream;

			const cleanup = () => {
				video.pause();
				video.srcObject = null;
				video.remove();
			};

			video.onloadedmetadata = async () => {
				try {
					await video.play();

					// Wait one extra frame tick to make sure a real frame has been
					// decoded — videoWidth/videoHeight can be set slightly before
					// the first frame is actually painted.
					await new Promise((r) => requestAnimationFrame(r));

					if (!video.videoWidth || !video.videoHeight) {
						throw new Error('Video stream has no dimensions.');
					}

					const canvas = document.createElement('canvas');
					canvas.width = video.videoWidth;
					canvas.height = video.videoHeight;

					const ctx = canvas.getContext('2d');
					if (!ctx) {
						throw new Error('Failed to get 2D canvas context.');
					}

					ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
					resolve(canvas.toDataURL('image/png'));
				} catch (err) {
					reject(err);
				} finally {
					cleanup();
				}
			};

			video.onerror = (err) => {
				cleanup();
				reject(err);
			};
		});
	}
}
