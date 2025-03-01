import { extractFilenameFromUrl } from '../../../utilities/extract-filename-from-url';
import { IDownloadState, IFileDownloadOptions } from '../../../models/video-download.model';
import { DownloadQueueService } from '../download-queue.service';

export class CompletedState implements IDownloadState {
	public handle(options: IFileDownloadOptions, contextService: DownloadQueueService): void {
		contextService.toastrService.success(
			'PLUGIN.VIDEO.DOWNLOAD_COMPLETED_FOR',
			{ url: extractFilenameFromUrl(options.url) },
			'PLUGIN.VIDEO.DOWNLOAD'
		);
		contextService.remove(options.url);
	}
}
