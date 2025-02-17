import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { ToastrService } from '@gauzy/ui-core/core';
import { BehaviorSubject, Observable, firstValueFrom, from, of } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { IShareData } from '../models/share-video.model';

@Injectable({
	providedIn: 'root'
})
export class WebShareService {
	private shareStatusSubject = new BehaviorSubject<boolean | null>(null);
	public shareStatus$: Observable<boolean | null> = this.shareStatusSubject.asObservable();

	constructor(private readonly http: HttpClient, private readonly toastrService: ToastrService) {
		this.checkShareSupport();
	}

	// Check Web Share API Support
	private checkShareSupport(): void {
		this.shareStatusSubject.next(this.isSupported());
	}

	// Verify Web Share API Availability
	public isSupported(): boolean {
		return 'share' in navigator;
	}

	// Convert URL to File
	private async urlToFile(url: string): Promise<File | null> {
		try {
			// Fetch file from URL
			const response = await firstValueFrom(
				this.http.get(url, {
					responseType: 'blob'
				})
			);

			// Extract filename from URL
			const filename = this.extractFilenameFromUrl(url);

			// Create File object
			return new File([response], filename, {
				type: response.type
			});
		} catch (error) {
			console.error('Failed to convert URL to file:', error);
			return null;
		}
	}

	// Extract filename from URL
	private extractFilenameFromUrl(url: string): string {
		try {
			const parsedUrl = new URL(url);
			const pathname = parsedUrl.pathname;
			return pathname.split('/').pop() || 'shared-file';
		} catch {
			return 'shared-file';
		}
	}

	// Share Method with URL to File Conversion
	async share(data: IShareData): Promise<boolean> {
		if (!this.isSupported()) {
			this.fallbackShare(data);
			return false;
		}

		try {
			// Validate share data
			this.validateShareData(data);

			// Prepare share payload
			const sharePayload: IShareData = {
				title: data.title || document.title,
				text: data.text || '',
				url: data.url || window.location.href
			};

			// Convert file URLs to File objects
			let files: File[] = [];
			if (data.fileUrls && data.fileUrls.length > 0) {
				const filePromises = data.fileUrls.map((url) => this.urlToFile(url));
				files = (await Promise.all(filePromises)).filter((file) => file !== null) as File[];
			}

			// Add files to share payload if converted successfully
			if (files.length > 0) {
				(sharePayload as any).files = files;
			}

			// Trigger native share
			await navigator.share(sharePayload);

			// Track successful share
			this.trackShareEvent();

			return true;
		} catch (error) {
			this.handleShareError(error);
			return false;
		}
	}

	// Fallback Sharing Method
	private fallbackShare(data: IShareData): Observable<boolean> {
		// Clipboard fallback with RxJS
		const shareText = `${data.title}\n${data.text}\n${data.url}`;

		return from(navigator.clipboard.writeText(shareText)).pipe(
			map(() => {
				this.showFallbackNotification();
				return true;
			}),
			catchError((err) => {
				console.error('Fallback share failed:', err);
				return of(false);
			})
		);
	}

	// Validate Share Data
	private validateShareData(data: IShareData): void {
		if (!data.title && !data.text && !data.url && (!data.fileUrls || data.fileUrls.length === 0)) {
			throw new Error('No share content provided');
		}
	}

	// Error Handling
	private handleShareError(error: any): void {
		switch (error.name) {
			case 'AbortError':
				this.toastrService.error('PLUGIN.VIDEO.ERROR.SHARE_CANCELED', error.name);
				break;
			case 'DataError':
				this.toastrService.error('PLUGIN.VIDEO.ERROR.INVALID_SHARE_DATA', error.name);
				break;
			case 'NotAllowedError':
				this.toastrService.error('PLUGIN.VIDEO.ERROR.SHARE_NOT_ALLOWED', error.name);
				break;
			default:
				this.toastrService.error('PLUGIN.VIDEO.ERROR.UNEXPECTED_SHARING_ERROR', error);
		}
	}

	// Share Event Tracking
	private trackShareEvent(): void {
		// Implement your analytics tracking
		this.toastrService.success('PLUGIN.VIDEO.SHARED_SUCCESSFULLY');
	}

	// Fallback Notification
	private showFallbackNotification(): void {
		// You can integrate with your preferred notification system
		this.toastrService.success('PLUGIN.VIDEO.COPIED_SUCCESSFULLY');
	}
}
