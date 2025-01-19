import { IDownloadState, IFileDownloadOptions } from '../../../models/video-download.model';
import { DownloadQueueService } from '../download-queue.service';

export class FailedState implements IDownloadState {
	public handle(options: IFileDownloadOptions, contextService: DownloadQueueService): void {
		console.log(`Retrying download for: ${options.url}`);
		contextService.remove(options.url);
	}
}
