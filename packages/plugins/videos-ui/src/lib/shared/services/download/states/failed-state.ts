import { extractFilenameFromUrl } from '../../../utilities/extract-filename-from-url';
import { IDownloadState, IFileDownloadOptions } from '../../../models/video-download.model';
import { DownloadQueueService } from '../download-queue.service';

export class FailedState implements IDownloadState {
	public handle(options: IFileDownloadOptions, contextService: DownloadQueueService): void {
		contextService.toastrService.error('PLUGIN.VIDEO.DOWNLOAD_FAILED_FOR', 'PLUGIN.VIDEO.DOWNLOAD', {
			url: extractFilenameFromUrl(options.url)
		});
	}
}
