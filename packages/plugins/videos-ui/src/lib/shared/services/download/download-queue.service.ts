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
	private queueSubject = new BehaviorSubject<IFileDownloadOptions[]>([]);
	public queue$ = this.queueSubject.asObservable();

	private downloadStatusSubject = new BehaviorSubject<IDownload>({});
	public downloadStatus$ = this.downloadStatusSubject.asObservable();

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
					const { status = DownloadStatus.PENDING } = download[options.url];
					this.state = DownloadStateFactory.getState(status);
					this.state.handle(options, this);
				});
			});
	}

	public add(urls: string | string[]): boolean {
		const newItems = (Array.isArray(urls) ? urls : [urls])
			.map((url) => ({ url }))
			.filter((item) => !this.isDownloading(item.url));

		if (newItems.length > 0) {
			this.queueSubject.next([...this.queueSubject.value, ...newItems]);
			return true;
		}

		return false;
	}

	private isDownloading(url: string): boolean {
		const download = this.getStatus(url);
		return download.status === DownloadStatus.DOWNLOADING;
	}

	public remove(url: string): void {
		// Remove the URL from the queue
		const updatedQueue = this.queueSubject.value.filter((item) => item.url !== url);
		this.queueSubject.next(updatedQueue);

		// Remove the status associated with the URL
		const updatedStatus = { ...this.downloadStatusSubject.value };
		delete updatedStatus[url];
		this.downloadStatusSubject.next(updatedStatus);

		// Trigger the process to ensure downloads continue if needed
		this.process();
	}

	private process(): void {
		const activeDownloads = this.getActiveCount();
		const pendingDownloads = this.queueSubject.value.filter(
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
		const current = this.downloadStatusSubject.value;
		const currentStatus = {
			...current,
			[url]: {
				...current[url],
				...download
			}
		};
		this.downloadStatusSubject.next(currentStatus);
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
		return this.downloadStatusSubject.value[url] || fallBackDownload;
	}

	private getActiveCount(): number {
		return Object.values(this.downloadStatusSubject.value).filter(
			({ status }) => status === DownloadStatus.DOWNLOADING
		).length;
	}
}
