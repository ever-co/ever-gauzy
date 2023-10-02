import { Injectable } from '@angular/core';
import { StatusIconCacheService } from './status-icon-cache.service';
import { concatMap, Observable, shareReplay } from 'rxjs';
import { HttpClient } from '@angular/common/http';
import { ImageViewerService } from '../../image-viewer/image-viewer.service';
import { DomSanitizer, SafeUrl } from '@angular/platform-browser';
import { map } from 'rxjs/operators';

@Injectable({
	providedIn: 'root',
})
export class StatusIconService {
	constructor(
		private readonly _statusIconCache: StatusIconCacheService,
		private readonly _imageService: ImageViewerService,
		private readonly _domSanitizer: DomSanitizer,
		private readonly _http: HttpClient
	) {}

	public load(iconUrl: string): Observable<SafeUrl> {
		let icon$ = this._statusIconCache.getValue(iconUrl);
		if (!icon$) {
			icon$ = this._http.get(iconUrl, { responseType: 'blob' }).pipe(
				concatMap((response: Blob) =>
					this._imageService.getBase64ImageFromBlob(response)
				),
				shareReplay(1)
			);
			this._statusIconCache.setValue(icon$, iconUrl);
		}
		return icon$.pipe(
			map((base64Image: string) =>
				this._domSanitizer.bypassSecurityTrustUrl(base64Image)
			)
		);
	}
}
