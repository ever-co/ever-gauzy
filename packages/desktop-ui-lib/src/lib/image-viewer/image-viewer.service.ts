import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { DomSanitizer, SafeUrl } from '@angular/platform-browser';
import { shareReplay, firstValueFrom, concatMap, map } from 'rxjs';
import { ImageCacheService, Store, TimeSlotCacheService } from '../services';
import { ITimeSlot } from '@gauzy/contracts';
import { API_PREFIX } from '../constants';
import { toParams } from '@gauzy/ui-core/common';

@Injectable({
	providedIn: 'root'
})
export class ImageViewerService {
	constructor(
		private readonly _imageCacheService: ImageCacheService,
		private readonly _domSanitizer: DomSanitizer,
		private readonly _http: HttpClient,
		private readonly _store: Store,
		private readonly _timeSlotCacheService: TimeSlotCacheService
	) {}

	public source(imageUrl: string): Promise<string> {
		this._imageCacheService.clear();
		let image$ = this._imageCacheService.getValue(imageUrl);
		if (!image$) {
			image$ = this._http.get(imageUrl, { responseType: 'blob' }).pipe(
				concatMap((response: Blob) => this.getBase64ImageFromBlob(response)),
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

	async getTimeSlot(values: { timeSlotId: string }): Promise<ITimeSlot | null> {
		const { timeSlotId } = values;
		if (!timeSlotId) {
			return null;
		}
		const { tenantId, organizationId } = this._store;
		const params = toParams({
			tenantId,
			organizationId,
			relations: ['screenshots'],
			order: {
				createdAt: 'DESC',
				screenshots: {
					recordedAt: 'DESC'
				}
			}
		});
		let timeSlots$ = this._timeSlotCacheService.getValue(timeSlotId);
		if (!timeSlots$) {
			timeSlots$ = this._http
				.get<ITimeSlot>(`${API_PREFIX}/timesheet/time-slot/${timeSlotId}`, {
					params
				})
				.pipe(
					map((response: any) => response),
					shareReplay(1)
				);
			this._timeSlotCacheService.setValue(timeSlots$, timeSlotId);
		}
		return firstValueFrom(timeSlots$);
	}
}
