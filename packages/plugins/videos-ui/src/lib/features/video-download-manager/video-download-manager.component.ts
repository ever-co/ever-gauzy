import { Component } from '@angular/core';
import { Actions } from '@ngneat/effects-ng';
import { Observable } from 'rxjs';
import { VideoActions } from '../../+state/video.action';
import { IActionButton } from '../../shared/models/action-button.model';
import { DownloadStatus, IDownload, IFileDownloadOptions } from '../../shared/models/video-download.model';
import { DownloadQueueService } from '../../shared/services/download/download-queue.service';

@Component({
	selector: 'plug-video-download-manager',
	templateUrl: './video-download-manager.component.html',
	styleUrl: './video-download-manager.component.scss'
})
export class VideoDownloadManagerComponent {
	public readonly retryButton: IActionButton = {
		icon: 'refresh-outline',
		label: 'Retry',
		status: 'primary',
		action: this.retryDownload.bind(this)
	};

	public readonly removeButton: IActionButton = {
		icon: 'trash-outline',
		status: 'danger',
		action: this.removeFromQueue.bind(this)
	};
	constructor(private readonly downloadQueueService: DownloadQueueService, private readonly actions: Actions) {}

	public get downloadQueue$(): Observable<IFileDownloadOptions[]> {
		return this.downloadQueueService.queue$;
	}

	public get downloadStatus$(): Observable<IDownload> {
		return this.downloadQueueService.downloadStatus$;
	}

	public removeFromQueue(url: string): void {
		this.actions.dispatch(VideoActions.removeFromQueue(url));
	}

	public retryDownload(url: string): void {
		this.actions.dispatch(VideoActions.retryDownload(url));
	}

	public extractFilename(url: string): string {
		try {
			const parsedUrl = new URL(url);
			return parsedUrl.pathname.split('/').pop() || 'download';
		} catch {
			return 'download';
		}
	}

	public getStatusColor(status: DownloadStatus): string {
		switch (status) {
			case DownloadStatus.DOWNLOADING:
				return 'primary';
			case DownloadStatus.COMPLETED:
				return 'success';
			case DownloadStatus.FAILED:
				return 'danger';
			default:
				return 'basic';
		}
	}
}
