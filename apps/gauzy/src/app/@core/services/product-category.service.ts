import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import {
	ProductCategoryTranslatable,
	ProductCategoryTranslated
} from '@gauzy/models';
import { first } from 'rxjs/operators';

@Injectable()
export class ProductCategoryService {
	PRODUCT_CATEGORY_URL = '/api/product-categories';

	constructor(private http: HttpClient) {}

	getById(id: string): Promise<ProductCategoryTranslatable> {
		return this.http
			.get<ProductCategoryTranslatable>(
				`${this.PRODUCT_CATEGORY_URL}/${id}`
			)
			.pipe(first())
			.toPromise();
	}

	getAll(
		langCode: string,
		relations?: string[],
		findInput?: any
	): Promise<{ items: ProductCategoryTranslated[] }> {
		const data = JSON.stringify({ relations, findInput, langCode });
		return this.http
			.get<{ items: ProductCategoryTranslated[] }>(
				this.PRODUCT_CATEGORY_URL,
				{
					params: { data }
				}
			)
			.pipe(first())
			.toPromise();
	}

	create(
		productTypeRequest: ProductCategoryTranslatable
	): Promise<ProductCategoryTranslatable> {
		return this.http
			.post<ProductCategoryTranslatable>(
				`${this.PRODUCT_CATEGORY_URL}`,
				productTypeRequest
			)
			.pipe(first())
			.toPromise();
	}

	update(
		productTypeRequest: ProductCategoryTranslatable
	): Promise<ProductCategoryTranslatable> {
		return this.http
			.put<ProductCategoryTranslatable>(
				`${this.PRODUCT_CATEGORY_URL}/${productTypeRequest.id}`,
				productTypeRequest
			)
			.pipe(first())
			.toPromise();
	}

	delete(id: string): Promise<ProductCategoryTranslatable> {
		return this.http
			.delete<ProductCategoryTranslatable>(
				`${this.PRODUCT_CATEGORY_URL}/${id}`
			)
			.pipe(first())
			.toPromise();
	}
}
