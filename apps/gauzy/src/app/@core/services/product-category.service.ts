import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import {
	IProductCategoryTranslatable,
	IProductCategoryTranslated
} from '@gauzy/contracts';
import { firstValueFrom } from 'rxjs';
import { API_PREFIX } from '../constants/app.constants';

@Injectable()
export class ProductCategoryService {
	PRODUCT_CATEGORY_URL = `${API_PREFIX}/product-categories`;

	constructor(private http: HttpClient) {}

	getById(id: string): Promise<IProductCategoryTranslatable> {
		return firstValueFrom(
			this.http
			.get<IProductCategoryTranslatable>(
				`${this.PRODUCT_CATEGORY_URL}/${id}`
			)
		);
	}

	getAllTranslated(
		options,
		params?
	): Promise<{ items: IProductCategoryTranslated[] }> {
		const data = JSON.stringify(options);
		return firstValueFrom(
			this.http
			.get<{ items: IProductCategoryTranslated[] }>(
				this.PRODUCT_CATEGORY_URL,
				{
					params: { data, ...params }
				}
			)
		);
	}

	count(findInput): Promise<Number> {
		const data = JSON.stringify(findInput);
		return firstValueFrom(
			this.http
			.get<number>(
				`${this.PRODUCT_CATEGORY_URL}/count`,
				{
					params: { data }
				}
			)
		);
	}

	create(
		productTypeRequest: IProductCategoryTranslatable
	): Promise<IProductCategoryTranslatable> {
		return firstValueFrom(
			this.http
			.post<IProductCategoryTranslatable>(
				`${this.PRODUCT_CATEGORY_URL}`,
				productTypeRequest
			)
		);
	}

	update(
		productTypeRequest: IProductCategoryTranslatable
	): Promise<IProductCategoryTranslatable> {
		return firstValueFrom(
			this.http
			.put<IProductCategoryTranslatable>(
				`${this.PRODUCT_CATEGORY_URL}/${productTypeRequest.id}`,
				productTypeRequest
			)
		);
	}

	delete(id: string): Promise<IProductCategoryTranslatable> {
		return firstValueFrom(
			this.http
			.delete<IProductCategoryTranslatable>(
				`${this.PRODUCT_CATEGORY_URL}/${id}`
			)
		);
	}
}
