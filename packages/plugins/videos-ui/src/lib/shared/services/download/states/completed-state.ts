import { IDownloadState, IFileDownloadOptions } from '../../../models/video-download.model';
import { DownloadQueueService } from '../download-queue.service';

export class CompletedState implements IDownloadState {
	public handle(options: IFileDownloadOptions, contextService: DownloadQueueService): void {
		console.log(`Download completed for: ${options.url}`);
		contextService.remove(options.url);
	}
}
