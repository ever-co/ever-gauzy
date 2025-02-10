import { HttpHeaders } from '@angular/common/http';
import { DownloadQueueService } from '../services/download/download-queue.service';

export interface IFileDownloadOptions {
	url: string;
	filename?: string;
	headers?: HttpHeaders | { [header: string]: string | string[] };
}

export interface IDownloadProgress {
	percentage: number;
	loaded: number;
	total: number;
}

export enum DownloadStatus {
	PENDING = 'PENDING',
	DOWNLOADING = 'DOWNLOADING',
	COMPLETED = 'COMPLETED',
	FAILED = 'FAILED',
	CANCELLED = 'CANCELLED'
}

export interface IFileSaveStrategy {
	save(blob: Blob, filename: string): void;
}

export interface IDownloadState {
	handle(options: IFileDownloadOptions, queueService?: DownloadQueueService): void;
}

export interface IDownloadItem {
	status: DownloadStatus;
	progress?: IDownloadProgress;
}

export type IDownload = Record<string, IDownloadItem>;
