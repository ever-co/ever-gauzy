import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { IImageAsset } from '@gauzy/contracts';
import { first } from 'rxjs/operators';
import { API_PREFIX } from '../constants/app.constants';

@Injectable()
export class ImageAssetService {
	constructor(private http: HttpClient) {}

	createImageAsset(imageAsset: IImageAsset): Promise<IImageAsset> {
		return this.http
			.post<IImageAsset>(`${API_PREFIX}/image-assets`, imageAsset)
			.pipe(first())
			.toPromise();
	}

	getAll(findInput): Promise<{ items: IImageAsset[] }> {
		const data = JSON.stringify({ findInput });

		return this.http
			.get<{ items: IImageAsset[] }>(`${API_PREFIX}/image-assets`, {
				params: { data }
			})
			.pipe(first())
			.toPromise();
	}

	deleteImageAsset(imageAsset: IImageAsset): Promise<IImageAsset> {
		return this.http
			.delete<IImageAsset>(`${API_PREFIX}/image-assets/${imageAsset.id}`)
			.pipe(first())
			.toPromise();
	}
}
