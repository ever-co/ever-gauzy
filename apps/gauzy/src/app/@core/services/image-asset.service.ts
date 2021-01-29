import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { IImageAsset } from '@gauzy/contracts';
import { first } from 'rxjs/operators';

@Injectable()
export class ImageAssetService {
	constructor(private http: HttpClient) {}

	createImageAsset(imageAsset: IImageAsset): Promise<IImageAsset> {
		return this.http
			.post<IImageAsset>('/api/image-assets', imageAsset)
			.pipe(first())
			.toPromise();
	}

	getAll(findInput): Promise<{ items: IImageAsset[] }> {
		const data = JSON.stringify({ findInput });

		return this.http
			.get<{ items: IImageAsset[] }>(`/api/image-assets`, {
				params: { data }
			})
			.pipe(first())
			.toPromise();
	}

	deleteImageAsset(imageAsset: IImageAsset): Promise<IImageAsset> {
		return this.http
			.delete<IImageAsset>(`/api/image-assets/${imageAsset.id}`)
			.pipe(first())
			.toPromise();
	}
}
