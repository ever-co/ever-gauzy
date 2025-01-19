import { IDownloadState, IFileDownloadOptions } from '../../../models/video-download.model';

export class DownloadingState implements IDownloadState {
	public handle(options: IFileDownloadOptions): void {
		console.log(`Download in progress for: ${options.url}`);
	}
}
