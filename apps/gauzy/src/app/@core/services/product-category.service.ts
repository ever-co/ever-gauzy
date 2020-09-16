import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import {
	IProductCategoryTranslatable,
	IProductCategoryTranslated
} from '@gauzy/models';
import { first } from 'rxjs/operators';

@Injectable()
export class ProductCategoryService {
	PRODUCT_CATEGORY_URL = '/api/product-categories';

	constructor(private http: HttpClient) {}

	getById(id: string): Promise<IProductCategoryTranslatable> {
		return this.http
			.get<IProductCategoryTranslatable>(
				`${this.PRODUCT_CATEGORY_URL}/${id}`
			)
			.pipe(first())
			.toPromise();
	}

	getAllTranslated(
		langCode: string,
		relations?: string[],
		findInput?: any
	): Promise<{ items: IProductCategoryTranslated[] }> {
		const data = JSON.stringify({ relations, findInput, langCode });
		return this.http
			.get<{ items: IProductCategoryTranslated[] }>(
				this.PRODUCT_CATEGORY_URL,
				{
					params: { data }
				}
			)
			.pipe(first())
			.toPromise();
	}

	create(
		productTypeRequest: IProductCategoryTranslatable
	): Promise<IProductCategoryTranslatable> {
		return this.http
			.post<IProductCategoryTranslatable>(
				`${this.PRODUCT_CATEGORY_URL}`,
				productTypeRequest
			)
			.pipe(first())
			.toPromise();
	}

	update(
		productTypeRequest: IProductCategoryTranslatable
	): Promise<IProductCategoryTranslatable> {
		return this.http
			.put<IProductCategoryTranslatable>(
				`${this.PRODUCT_CATEGORY_URL}/${productTypeRequest.id}`,
				productTypeRequest
			)
			.pipe(first())
			.toPromise();
	}

	delete(id: string): Promise<IProductCategoryTranslatable> {
		return this.http
			.delete<IProductCategoryTranslatable>(
				`${this.PRODUCT_CATEGORY_URL}/${id}`
			)
			.pipe(first())
			.toPromise();
	}
}
