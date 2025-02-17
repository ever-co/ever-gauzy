import { extractFilenameFromUrl } from '../../../utilities/extract-filename-from-url';
import { IDownloadState, IFileDownloadOptions } from '../../../models/video-download.model';
import { DownloadQueueService } from '../download-queue.service';

export class PendingState implements IDownloadState {
	public handle(options: IFileDownloadOptions, contextService: DownloadQueueService): void {
		contextService.toastrService.info('PLUGIN.VIDEO.STARTING_DOWNLOAD_FOR', 'PLUGIN.VIDEO.DOWNLOAD', {
			translationParams: {
				url: extractFilenameFromUrl(options.url)
			}
		});
		contextService.start(options);
	}
}
