import { Injectable, inject } from '@angular/core';
import { ElectronService } from './electron.service';

interface ScreenSources {
	id: string;
	name: string;
	display_id: string;
}

@Injectable({
	providedIn: 'root'
})
export class ScreenCaptureWebRTSService {
	private readonly electronService: ElectronService = inject(ElectronService);
	private cachedSourceIds: ScreenSources[] | null = null;

	async takeScreenshot(): Promise<{ screenshot: string; thumbnail: string }[]> {
		const sourceIds = await this.getSourceId();
		const streams = await Promise.all(
			sourceIds.map((source) => {
				return (navigator.mediaDevices as any).getUserMedia({
					audio: false,
					video: {
						mandatory: {
							chromeMediaSource: 'desktop',
							chromeMediaSourceId: source.id,
							maxFrameRate: 5
						}
					}
				} as any);
			})
		);

		try {
			return await Promise.all(streams.map((stream) => this.grabFrame(stream)));
		} finally {
			streams.forEach((stream) => stream.getTracks().forEach((track) => track.stop()));
		}
	}

	async testScreenshot(): Promise<{ screenshot: string; thumbnail: string }> {
		const images = await this.takeScreenshot();
		return images[0];
	}

	private async getSourceId(): Promise<ScreenSources[]> {
		if (this.cachedSourceIds) {
			return this.cachedSourceIds;
		}
		const sources = await this.electronService.desktopCapturer.getSources({ types: ['screen'] });

		this.cachedSourceIds = sources;
		return this.cachedSourceIds;
	}

	/**
	 * Attaches a stream to a detached <video>, waits for a frame to be
	 * available, draws it to an offscreen <canvas>, and returns the PNG data URL.
	 */
	private grabFrame(stream: MediaStream): Promise<{ screenshot: string; thumbnail: string }> {
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

					// Create thumbnail canvas of size 320x240
					const thumbCanvas = document.createElement('canvas');
					thumbCanvas.width = 320;
					thumbCanvas.height = 240;

					const thumbCtx = thumbCanvas.getContext('2d');
					if (!thumbCtx) {
						throw new Error('Failed to get 2D canvas context for thumbnail.');
					}

					thumbCtx.drawImage(video, 0, 0, thumbCanvas.width, thumbCanvas.height);

					resolve({
						screenshot: canvas.toDataURL('image/png'),
						thumbnail: thumbCanvas.toDataURL('image/png')
					});
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
