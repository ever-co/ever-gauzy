import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { first } from 'rxjs/operators';
import {
	IProductTypeTranslatable,
	IProductTypeTranslated
} from '@gauzy/contracts';

@Injectable()
export class ProductTypeService {
	PRODUCT_TYPES_URL = '/api/product-types';

	constructor(private http: HttpClient) {}

	getById(id: string = ''): Promise<IProductTypeTranslatable> {
		return this.http
			.get<IProductTypeTranslatable>(`${this.PRODUCT_TYPES_URL}/${id}`)
			.pipe(first())
			.toPromise();
	}

	getAll(
		relations?: string[],
		findInput?: any
	): Promise<{ items: IProductTypeTranslatable[] }> {
		const data = JSON.stringify({ relations, findInput });
		return this.http
			.get<{ items: IProductTypeTranslatable[] }>(
				this.PRODUCT_TYPES_URL,
				{
					params: { data }
				}
			)
			.pipe(first())
			.toPromise();
	}

	getAllTranslated(
		langCode: string,
		relations?: string[],
		findInput?: any
	): Promise<{ items: IProductTypeTranslated[] }> {
		const data = JSON.stringify({ relations, findInput, langCode });
		return this.http
			.get<{ items: IProductTypeTranslated[] }>(
				`${this.PRODUCT_TYPES_URL}`,
				{
					params: { data }
				}
			)
			.pipe(first())
			.toPromise();
	}

	create(
		productTypeRequest: IProductTypeTranslatable
	): Promise<IProductTypeTranslatable> {
		return this.http
			.post<IProductTypeTranslatable>(
				`${this.PRODUCT_TYPES_URL}`,
				productTypeRequest
			)
			.pipe(first())
			.toPromise();
	}

	update(
		productTypeRequest: IProductTypeTranslatable
	): Promise<IProductTypeTranslatable> {
		return this.http
			.put<IProductTypeTranslatable>(
				`${this.PRODUCT_TYPES_URL}/${productTypeRequest.id}`,
				productTypeRequest
			)
			.pipe(first())
			.toPromise();
	}

	delete(id: string): Promise<IProductTypeTranslatable> {
		return this.http
			.delete<IProductTypeTranslatable>(`${this.PRODUCT_TYPES_URL}/${id}`)
			.pipe(first())
			.toPromise();
	}
}
