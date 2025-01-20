import { Injectable } from '@angular/core';
import { BehaviorSubject, filter, map, withLatestFrom } from 'rxjs';
import {
	DownloadStatus,
	IDownload,
	IDownloadItem,
	IDownloadState,
	IFileDownloadOptions
} from '../../models/video-download.model';
import { DownloadStateFactory } from './download-state.factory';
import { FileDownloadService } from './file-download.service';

@Injectable({ providedIn: 'root' })
export class DownloadQueueService {
	private _queue$ = new BehaviorSubject<IFileDownloadOptions[]>([]);
	public queue$ = this._queue$.asObservable();

	private _downloadStatus$ = new BehaviorSubject<IDownload>({});
	public downloadStatus$ = this._downloadStatus$.asObservable();

	private readonly MAX_CONCURRENT_DOWNLOADS = 3;
	private state: IDownloadState = DownloadStateFactory.getState(DownloadStatus.PENDING);

	constructor(private fileDownloadService: FileDownloadService) {
		this.queue$.pipe(filter((queue) => queue.length > 0)).subscribe(() => this.process());
		this.downloadStatus$
			.pipe(
				map((download) => download),
				withLatestFrom(this.queue$)
			)
			.subscribe(([download, queues]) => {
				queues.forEach((options) => {
					const { status = DownloadStatus.PENDING } = download[options.url] || {};
					this.state = DownloadStateFactory.getState(status);
					this.state.handle(options, this);
				});
			});
	}

	public add(urls: string | string[]): boolean {
		// Ensure we have valid input
		if (!urls || (Array.isArray(urls) && urls.length === 0)) {
			return false;
		}

		const currentQueue = this._queue$.value;
		const newUrls = Array.isArray(urls) ? urls : [urls];

		// Filter out URLs already in the queue
		const uniqueUrls = newUrls.filter((url) => !currentQueue.some((item) => item.url === url));

		if (uniqueUrls.length > 0) {
			// Add new unique URLs to the queue
			const updatedQueue = [...currentQueue, ...uniqueUrls.map((url) => ({ url }))];
			this._queue$.next(updatedQueue);
			return true;
		}

		return false;
	}

	public remove(url: string): void {
		// Cancel the download
		this.fileDownloadService.cancel(url);
		// Remove the URL from the queue
		const updatedQueue = this._queue$.value.filter((item) => item.url !== url);
		this._queue$.next(updatedQueue);

		// Remove the status associated with the URL
		const updatedStatus = { ...this._downloadStatus$.value };
		delete updatedStatus[url];
		this._downloadStatus$.next(updatedStatus);

		// Trigger the process to ensure downloads continue if needed
		this.process();
	}

	public retry(url: string): boolean {
		const options = this._queue$.value.find((item) => item.url === url);
		if (options) {
			this.start(options);
			return true;
		}

		return false;
	}

	private process(): void {
		const activeDownloads = this.getActiveCount();
		const pendingDownloads = this._queue$.value.filter(
			(item) => this.getStatus(item.url).status === DownloadStatus.PENDING
		);

		pendingDownloads.slice(0, this.MAX_CONCURRENT_DOWNLOADS - activeDownloads).forEach((options) => {
			this.state = DownloadStateFactory.getState(DownloadStatus.PENDING);
			this.state.handle(options, this);
		});
	}

	public start(options: IFileDownloadOptions): void {
		this.fileDownloadService.execute(options).subscribe({
			next: (progress) => {
				this.updateStatus(options.url, {
					status: DownloadStatus.DOWNLOADING,
					progress
				});
			},
			complete: () => {
				this.updateStatus(options.url, { status: DownloadStatus.COMPLETED });
			},
			error: () => {
				this.updateStatus(options.url, { status: DownloadStatus.FAILED });
			}
		});
	}

	public updateStatus(url: string, download: IDownloadItem): void {
		const current = this._downloadStatus$.value;
		const currentStatus = {
			...current,
			[url]: {
				...current[url],
				...download
			}
		};
		this._downloadStatus$.next(currentStatus);
	}

	private getStatus(url: string): IDownloadItem {
		const fallBackDownload: IDownloadItem = {
			status: DownloadStatus.PENDING,
			progress: {
				percentage: 0,
				loaded: 0,
				total: 0
			}
		};
		return this._downloadStatus$.value[url] || fallBackDownload;
	}

	private getActiveCount(): number {
		return Object.values(this._downloadStatus$.value).filter(({ status }) => status === DownloadStatus.DOWNLOADING)
			.length;
	}
}
