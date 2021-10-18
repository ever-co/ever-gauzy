import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { IImageAsset } from '@gauzy/contracts';
import { firstValueFrom } from 'rxjs';
import { API_PREFIX } from '../constants/app.constants';

@Injectable()
export class ImageAssetService {
	constructor(private http: HttpClient) {}

	createImageAsset(imageAsset: IImageAsset): Promise<IImageAsset> {
		return firstValueFrom(
			this.http
			.post<IImageAsset>(`${API_PREFIX}/image-assets`, imageAsset)
		);
	}

	getAll(findInput): Promise<{ items: IImageAsset[] }> {
		const data = JSON.stringify({ findInput });
		return firstValueFrom(
			this.http
			.get<{ items: IImageAsset[] }>(`${API_PREFIX}/image-assets`, {
				params: { data }
			})
		);
	}

	deleteImageAsset(imageAsset: IImageAsset): Promise<IImageAsset> {
		return firstValueFrom(
			this.http
			.delete<IImageAsset>(`${API_PREFIX}/image-assets/${imageAsset.id}`)
		);
	}

	updateImageAsset(imageAsset: IImageAsset): Promise<IImageAsset> {
		return firstValueFrom(
			this.http
			.put<IImageAsset>(
				`${API_PREFIX}/image-assets/${imageAsset.id}`,
				imageAsset
			)
		);
	}
}
