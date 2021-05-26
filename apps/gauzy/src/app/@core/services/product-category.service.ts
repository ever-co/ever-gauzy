import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import {
	IProductCategoryTranslatable,
	IProductCategoryTranslated
} from '@gauzy/contracts';
import { first } from 'rxjs/operators';
import { API_PREFIX } from '../constants/app.constants';

@Injectable()
export class ProductCategoryService {
	PRODUCT_CATEGORY_URL = `${API_PREFIX}/product-categories`;

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
		options,
		params?
	): Promise<{ items: IProductCategoryTranslated[] }> {
		const data = JSON.stringify(options);
		return this.http
			.get<{ items: IProductCategoryTranslated[] }>(
				this.PRODUCT_CATEGORY_URL,
				{
					params: { data, ...params }
				}
			)
			.pipe(first())
			.toPromise();
	}

	count(findInput): Promise<Number> {
		const data = JSON.stringify(findInput);
		return this.http
			.get<number>(
				`${this.PRODUCT_CATEGORY_URL}/count`,
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
