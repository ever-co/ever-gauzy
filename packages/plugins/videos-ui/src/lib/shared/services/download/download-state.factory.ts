import { DownloadStatus, IDownloadState } from '../../models/video-download.model';
import { CompletedState } from './states/completed-state';
import { DownloadingState } from './states/downloading-state';
import { FailedState } from './states/failed-state';
import { PendingState } from './states/pending-state';

export class DownloadStateFactory {
	public static getState(status: DownloadStatus): IDownloadState {
		switch (status) {
			case DownloadStatus.PENDING:
				return new PendingState();
			case DownloadStatus.DOWNLOADING:
				return new DownloadingState();
			case DownloadStatus.COMPLETED:
				return new CompletedState();
			case DownloadStatus.FAILED:
				return new FailedState();
			default:
				throw new Error(`Unknown state for status: ${status}`);
		}
	}
}
