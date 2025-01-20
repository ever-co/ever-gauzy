import { IDownloadState, IFileDownloadOptions } from '../../../models/video-download.model';

export class FailedState implements IDownloadState {
	public handle(options: IFileDownloadOptions): void {
		console.log(`Retrying download for: ${options.url}`);
	}
}
