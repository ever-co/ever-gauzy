import { Component } from '@angular/core';
import { Observable } from 'rxjs';
import { IDownload, IFileDownloadOptions } from '../../shared/models/video-download.model';
import { DownloadQueueService } from '../../shared/services/download/download-queue.service';
import { Actions } from '@ngneat/effects-ng';
import { VideoActions } from '../../+state/video.action';

@Component({
	selector: 'plug-video-download-manager',
	templateUrl: './video-download-manager.component.html',
	styleUrl: './video-download-manager.component.scss'
})
export class VideoDownloadManagerComponent {
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
}
