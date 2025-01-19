import { IDownloadState, IFileDownloadOptions } from '../../../models/video-download.model';
import { DownloadQueueService } from '../download-queue.service';

export class PendingState implements IDownloadState {
	public handle(options: IFileDownloadOptions, contextService: DownloadQueueService): void {
		console.log(`Starting download for: ${options.url}`);
		contextService.start(options);
	}
}
