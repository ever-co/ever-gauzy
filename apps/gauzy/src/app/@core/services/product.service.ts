import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { first } from 'rxjs/operators';
import {
	IProduct,
	IProductFindInput,
	IProductTranslatableCreateInput,
	IProductTranslatable,
	IProductTranslated,
	IImageAsset
} from '@gauzy/contracts';
import { API_PREFIX } from '../constants/app.constants';

@Injectable()
export class ProductService {
	PRODUCTS_URL = `${API_PREFIX}/products`;

	constructor(private http: HttpClient) { }

	getAll(
		relations?: string[],
		findInput?: IProductFindInput,
		languageCode?: string
	): Promise<{ items: IProductTranslatable[] }> {
		const data = JSON.stringify({ relations, findInput });
		return this.http
			.get<{ items: IProductTranslatable[] }>(
				`${this.PRODUCTS_URL}/local/${languageCode}`,
				{
					params: { data }
				}
			)
			.pipe(first())
			.toPromise();
	}

	count(findInput): Promise<Number> {
		const data = JSON.stringify(findInput);
		return this.http
			.get<number>(
				`${this.PRODUCTS_URL}/count`,
				{
					params: { data }
				}
			)
			.pipe(first())
			.toPromise();
	}

	getAllTranslated(
		options,
		params,
		languageCode?: string
	) {
		const data = JSON.stringify({
			relations: options.relations,
			options: options.findInput
		});

		return this.http
			.get<{ items: IProductTranslated[] }>(
				`${this.PRODUCTS_URL}/local/${languageCode}`,
				{ params: { data, ...params } }
			)
			.pipe(first())
			.toPromise();
	}

	getOneTranslated(
		id: string,
		relations?: string[],
		languageCode?: string
	): Promise<IProductTranslated> {
		const data = JSON.stringify({ relations });
		return this.http
			.get<IProductTranslated>(
				`${this.PRODUCTS_URL}/local/${languageCode}/${id}`,
				{ params: { data } }
			)
			.pipe(first())
			.toPromise();
	}

	getById(id: string, relations?: string[], findInput?: IProductFindInput) {
		const data = JSON.stringify({ relations, findInput });
		return this.http
			.get<IProduct>(`${this.PRODUCTS_URL}/${id}`, {
				params: { data }
			})
			.pipe(first())
			.toPromise();
	}

	create(
		product: IProductTranslatableCreateInput
	): Promise<IProductTranslatable> {
		return this.http
			.post<IProductTranslatable>(`${this.PRODUCTS_URL}/create`, product)
			.pipe(first())
			.toPromise();
	}

	update(
		product: IProductTranslatableCreateInput
	): Promise<IProductTranslatable> {
		return this.http
			.put<IProductTranslatable>(
				`${this.PRODUCTS_URL}/${product.id}`,
				product
			)
			.pipe(first())
			.toPromise();
	}

	delete(id: string): Promise<any> {
		return this.http
			.delete(`${this.PRODUCTS_URL}/${id}`)
			.pipe(first())
			.toPromise();
	}

	addGalleryImages(
		id: string,
		images: IImageAsset[]
	): Promise<IProductTranslatable> {
		return this.http
			.post<IProductTranslatable>(
				`${this.PRODUCTS_URL}/add-images/${id}`,
				images
			)
			.pipe(first())
			.toPromise();
	}

	deleteGalleryImage(
		id: string,
		image: IImageAsset
	): Promise<IProductTranslatable> {
		return this.http
			.delete<IProductTranslatable>(
				`${this.PRODUCTS_URL}/${id}/delete-gallery-image/${image.id}`
			)
			.pipe(first())
			.toPromise();
	}

	setAsFeatured(
		id: string,
		image: IImageAsset
	): Promise<IProductTranslatable> {
		return this.http
			.post<IProductTranslatable>(
				`${this.PRODUCTS_URL}/set-as-featured/${id}`,
				image
			)
			.pipe(first())
			.toPromise();
	}

	deleteFeaturedImage(id: string): Promise<IProductTranslatable> {
		return this.http
			.delete<IProductTranslatable>(
				`${this.PRODUCTS_URL}/delete-featured-image/${id}`
			)
			.pipe(first())
			.toPromise();
	}
}
