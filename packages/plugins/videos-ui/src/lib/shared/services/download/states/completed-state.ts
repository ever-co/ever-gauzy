import { extractFilenameFromUrl } from '../../../utilities/extract-filename-from-url';
import { IDownloadState, IFileDownloadOptions } from '../../../models/video-download.model';
import { DownloadQueueService } from '../download-queue.service';

export class CompletedState implements IDownloadState {
	public handle(options: IFileDownloadOptions, contextService: DownloadQueueService): void {
		contextService.toastrService.success(
			`Download completed for: ${extractFilenameFromUrl(options.url)}`,
			'Download'
		);
		contextService.remove(options.url);
	}
}
