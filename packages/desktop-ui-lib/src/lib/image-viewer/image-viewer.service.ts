import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { DomSanitizer, SafeUrl } from '@angular/platform-browser';
import { shareReplay, firstValueFrom, concatMap } from 'rxjs';
import { ImageCacheService } from '../services';

@Injectable({
	providedIn: 'root',
})
export class ImageViewerService {
	constructor(
		private readonly _imageCacheService: ImageCacheService,
		private readonly _domSanitizer: DomSanitizer,
		private readonly _http: HttpClient
	) { }

	public source(imageUrl: string): Promise<string> {
		this._imageCacheService.clear();
		let image$ = this._imageCacheService.getValue(imageUrl);
		if (!image$) {
			image$ = this._http.get(imageUrl, { responseType: 'blob' }).pipe(
				concatMap((response: Blob) =>
					this.getBase64ImageFromBlob(response)
				),
				shareReplay(1)
			);
			this._imageCacheService.setValue(image$, imageUrl);
		}
		return firstValueFrom(image$);
	}

	public async sanitizeImgUrl(img: string): Promise<SafeUrl> {
		let imgUrl = img;
		if (this.isValidUrl(img)) {
			const imgTempUrl = await this.source(img);
			imgUrl = await this.getBase64ImageFromUrl(imgTempUrl);
		}
		return this._domSanitizer.bypassSecurityTrustUrl(imgUrl);
	}

	public async getBase64ImageFromUrl(image?: string): Promise<string> {
		const res = await fetch(image);
		const blob = await res.blob();
		return await this.getBase64ImageFromBlob(blob);
	}

	public async getBase64ImageFromBlob(blob: Blob): Promise<string> {
		return new Promise((resolve, reject) => {
			const reader = new FileReader();
			reader.addEventListener(
				'load',
				function () {
					resolve(reader.result as string);
				},
				false
			);

			reader.onerror = () => {
				return reject(this);
			};
			reader.readAsDataURL(blob);
		});
	}

	public isValidUrl(url: string): boolean {
		try {
			const imgUrl = new URL(url);
			return !!imgUrl;
		} catch (error) {
			return false;
		}
	}
}
