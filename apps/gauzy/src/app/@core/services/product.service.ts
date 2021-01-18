import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { first } from 'rxjs/operators';
import {
	IProduct,
	IProductFindInput,
	IProductTranslatableCreateInput,
	IProductTranslatable
} from '@gauzy/models';

@Injectable()
export class ProductService {
	PRODUCTS_URL = '/api/products';

	constructor(private http: HttpClient) {}

	getAll(
		relations?: string[],
		findInput?: IProductFindInput,
		languageCode?: string
	): Promise<{ items: IProduct[] }> {
		const data = JSON.stringify({ relations, findInput });
		return this.http
			.get<{ items: IProduct[] }>(
				`${this.PRODUCTS_URL}/local/${languageCode}`,
				{
					params: { data }
				}
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

	update(product: IProductTranslatable): Promise<IProductTranslatable> {
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
}
