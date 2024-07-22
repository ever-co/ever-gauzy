import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { IImageAsset, IImageAssetFindInput, IPagination } from '@gauzy/contracts';
import { API_PREFIX, toParams } from '@gauzy/ui-core/common';
import { CrudService } from '../crud/crud.service';

@Injectable()
export class ImageAssetService extends CrudService<IImageAsset> {
	static readonly API_URL = `${API_PREFIX}/image-assets`;

	constructor(http: HttpClient) {
		super(http, ImageAssetService.API_URL);
	}

	createImageAsset(imageAsset: IImageAsset): Promise<IImageAsset> {
		return firstValueFrom(this.http.post<IImageAsset>(`${API_PREFIX}/image-assets`, imageAsset));
	}

	getAll(where?: IImageAssetFindInput): Promise<IPagination<IImageAsset>> {
		return firstValueFrom(
			this.http.get<IPagination<IImageAsset>>(`${API_PREFIX}/image-assets`, {
				params: toParams({ where })
			})
		);
	}

	deleteImageAsset(imageAsset: IImageAsset): Promise<IImageAsset> {
		return firstValueFrom(this.http.delete<IImageAsset>(`${API_PREFIX}/image-assets/${imageAsset.id}`));
	}

	updateImageAsset(imageAsset: IImageAsset): Promise<IImageAsset> {
		return firstValueFrom(this.http.put<IImageAsset>(`${API_PREFIX}/image-assets/${imageAsset.id}`, imageAsset));
	}
}
