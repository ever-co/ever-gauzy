import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import {
	IProduct,
	IProductFindInput,
	IProductTranslatableCreateInput,
	IProductTranslatable,
	IProductTranslated,
	IImageAsset
} from '@gauzy/contracts';
import { API_PREFIX } from '@gauzy/ui-sdk/common';

@Injectable()
export class ProductService {
	PRODUCTS_URL = `${API_PREFIX}/products`;

	constructor(private http: HttpClient) {}

	getAll(
		relations?: string[],
		findInput?: IProductFindInput,
		languageCode?: string
	): Promise<{ items: IProductTranslatable[] }> {
		const data = JSON.stringify({ relations, findInput });
		return firstValueFrom(
			this.http.get<{ items: IProductTranslatable[] }>(`${this.PRODUCTS_URL}/local/${languageCode}`, {
				params: { data }
			})
		);
	}

	count(findInput): Promise<Number> {
		const data = JSON.stringify(findInput);
		return firstValueFrom(
			this.http.get<number>(`${this.PRODUCTS_URL}/count`, {
				params: { data }
			})
		);
	}

	getAllTranslated(options, params, languageCode?: string) {
		const data = JSON.stringify({
			relations: options.relations,
			options: options.findInput
		});

		return firstValueFrom(
			this.http.get<{ items: IProductTranslated[] }>(`${this.PRODUCTS_URL}/local/${languageCode}`, {
				params: { data, ...params }
			})
		);
	}

	getOneTranslated(id: string, relations?: string[], languageCode?: string): Promise<IProductTranslated> {
		const data = JSON.stringify({ relations });
		return firstValueFrom(
			this.http.get<IProductTranslated>(`${this.PRODUCTS_URL}/local/${languageCode}/${id}`, { params: { data } })
		);
	}

	getById(id: string, relations?: string[], findInput?: IProductFindInput) {
		const data = JSON.stringify({ relations, findInput });
		return firstValueFrom(
			this.http.get<IProduct>(`${this.PRODUCTS_URL}/${id}`, {
				params: { data }
			})
		);
	}

	create(product: IProductTranslatableCreateInput): Promise<IProductTranslatable> {
		return firstValueFrom(this.http.post<IProductTranslatable>(`${this.PRODUCTS_URL}`, product));
	}

	update(product: IProductTranslatableCreateInput): Promise<IProductTranslatable> {
		return firstValueFrom(this.http.put<IProductTranslatable>(`${this.PRODUCTS_URL}/${product.id}`, product));
	}

	delete(id: string): Promise<any> {
		return firstValueFrom(this.http.delete(`${this.PRODUCTS_URL}/${id}`));
	}

	addGalleryImages(id: string, images: IImageAsset[]): Promise<IProductTranslatable> {
		return firstValueFrom(this.http.post<IProductTranslatable>(`${this.PRODUCTS_URL}/add-images/${id}`, images));
	}

	deleteGalleryImage(id: string, image: IImageAsset): Promise<IProductTranslatable> {
		return firstValueFrom(
			this.http.delete<IProductTranslatable>(`${this.PRODUCTS_URL}/${id}/gallery-image/${image.id}`)
		);
	}

	setAsFeatured(id: string, image: IImageAsset): Promise<IProductTranslatable> {
		return firstValueFrom(
			this.http.post<IProductTranslatable>(`${this.PRODUCTS_URL}/set-as-featured/${id}`, image)
		);
	}

	deleteFeaturedImage(id: string): Promise<IProductTranslatable> {
		return firstValueFrom(this.http.delete<IProductTranslatable>(`${this.PRODUCTS_URL}/featured-image/${id}`));
	}
}
