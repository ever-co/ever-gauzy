import { extractFilenameFromUrl } from '../../../utilities/extract-filename-from-url';
import { IDownloadState, IFileDownloadOptions } from '../../../models/video-download.model';
import { DownloadQueueService } from '../download-queue.service';

export class PendingState implements IDownloadState {
	public handle(options: IFileDownloadOptions, contextService: DownloadQueueService): void {
		contextService.toastrService.info(`Starting download for: ${extractFilenameFromUrl(options.url)}`, 'Download');
		contextService.start(options);
	}
}
