import { HttpClient, HttpEventType } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { ErrorHandlingService } from '@gauzy/ui-core/core';
import { Observable, Subscription } from 'rxjs';
import { IDownloadProgress, IFileDownloadOptions } from '../../models/video-download.model';
import { FileSaveStrategy } from './strategies/file-save.strategy';
import { extractFilenameFromUrl } from '../../utilities/extract-filename-from-url';

@Injectable({ providedIn: 'root' })
export class FileDownloadService {
	private activeDownloads = new Map<string, Subscription>();

	constructor(
		private readonly http: HttpClient,
		private readonly fileSaveStrategy: FileSaveStrategy,
		private readonly errorHandler: ErrorHandlingService
	) {}

	public execute(options: IFileDownloadOptions): Observable<IDownloadProgress> {
		return new Observable((observer) => {
			const req = this.http.get(options.url, {
				reportProgress: true,
				observe: 'events',
				responseType: 'blob',
				headers: options.headers
			});

			const subscription = req.subscribe({
				next: (event) => {
					if (event.type === HttpEventType.DownloadProgress && event.total !== undefined) {
						observer.next({
							percentage: Math.round((100 * event.loaded) / event.total),
							loaded: event.loaded,
							total: event.total
						});
					} else if (event.type === HttpEventType.Response) {
						const filename = options.filename || extractFilenameFromUrl(options.url, 'download.mp4');
						this.fileSaveStrategy.save(event.body as Blob, filename);
						observer.complete();
					}
				},
				error: (error) => {
					this.errorHandler.handleError(error);
					observer.error(error);
				}
			});

			this.activeDownloads.set(options.url, subscription);

			return () => this.cancel(options.url);
		});
	}

	public cancel(url: string): void {
		const subscription = this.activeDownloads.get(url);
		if (subscription) {
			subscription.unsubscribe();
			this.activeDownloads.delete(url);
		}
	}
}
