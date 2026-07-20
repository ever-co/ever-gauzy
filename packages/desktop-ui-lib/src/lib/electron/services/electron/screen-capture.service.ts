import { Injectable, inject } from '@angular/core';
import { ElectronService } from './electron.service';

interface ScreenSources {
	id: string;
	name: string;
	display_id: string;
}

export interface IScreenCaptureFrame {
	screenshot: string;
	thumbnail: string;
	name: string;
	display_id: string;
}

@Injectable({
	providedIn: 'root'
})
export class ScreenCaptureWebRTCService {
	private readonly electronService: ElectronService = inject(ElectronService);

	async takeScreenshot({ resetScreen }: { resetScreen: boolean }): Promise<IScreenCaptureFrame[]> {
		const sourceIds = await this.getSourceId(resetScreen);
		const allDisplays: { id: number; bounds: { width: number; height: number } }[] =
			await this.electronService.invoke('GET_ALL_DISPLAYS');
		const streamResults = await Promise.allSettled(
			sourceIds.map((source, index) => {
				// display_id can be empty or mismatched on Wayland/PipeWire —
				// fall back to positional mapping, then the first display.
				const display =
					allDisplays.find((d) => String(d.id) === source.display_id) ??
					allDisplays[index] ??
					allDisplays[0];
				const width = display?.bounds.width ?? 1920;
				const height = display?.bounds.height ?? 1080;
				return (navigator.mediaDevices as any).getUserMedia({
					audio: false,
					video: {
						mandatory: {
							chromeMediaSource: 'desktop',
							chromeMediaSourceId: source.id,
							maxFrameRate: 5,
							maxWidth: width,
							maxHeight: height
						}
					}
				} as any) as Promise<MediaStream>;
			})
		);

		// Keep each stream paired with its source so frames retain display metadata
		const streams: { stream: MediaStream; source: ScreenSources }[] = [];
		streamResults.forEach((result, index) => {
			if (result.status === 'fulfilled') {
				streams.push({ stream: result.value, source: sourceIds[index] });
			} else {
				console.error('[ScreenCapture] getUserMedia failed:', result.reason);
			}
		});

		try {
			const frameResults = await Promise.allSettled(streams.map(({ stream }) => this.grabFrame(stream)));
			const frames: IScreenCaptureFrame[] = [];
			frameResults.forEach((result, index) => {
				if (result.status === 'fulfilled') {
					const { name, display_id } = streams[index].source;
					frames.push({ ...result.value, name, display_id });
				} else {
					console.error('[ScreenCapture] grabFrame failed:', result.reason);
				}
			});
			return frames;
		} finally {
			streams.forEach(({ stream }) => stream.getTracks().forEach((track) => track.stop()));
		}
	}

	async testScreenshot(): Promise<IScreenCaptureFrame | null> {
		// Reset cache to get the latest screen sources
		const images = await this.takeScreenshot({ resetScreen: true });
		return images.length > 0 ? images[0] : null;
	}

	private async getSourceId(resetScreen = false): Promise<ScreenSources[]> {
		const sources: ScreenSources[] = await this.electronService.invoke('GET_SCREEN_SOURCES', { resetScreen });
		return sources;
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

			const timeout = setTimeout(() => {
				cleanup();
				reject(new Error('grabFrame timed out: video metadata never loaded'));
			}, 10_000);

			const settle = (fn: () => void) => {
				clearTimeout(timeout);
				fn();
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

					settle(() =>
						resolve({
							screenshot: canvas.toDataURL('image/png'),
							thumbnail: thumbCanvas.toDataURL('image/png')
						})
					);
				} catch (err) {
					settle(() => reject(err));
				} finally {
					cleanup();
				}
			};

			video.onerror = () => {
				cleanup();
				settle(() => reject(new Error(video.error?.message || 'Video element failed to load the capture stream.')));
			};
		});
	}
}
