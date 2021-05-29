import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { first } from 'rxjs/operators';
import {
	IProductTypeTranslatable,
	IProductTypeTranslated
} from '@gauzy/contracts';
import { API_PREFIX } from '../constants/app.constants';

@Injectable()
export class ProductTypeService {
	PRODUCT_TYPES_URL = `${API_PREFIX}/product-types`;

	constructor(private http: HttpClient) { }

	getById(id: string = ''): Promise<IProductTypeTranslatable> {
		return this.http
			.get<IProductTypeTranslatable>(`${this.PRODUCT_TYPES_URL}/${id}`)
			.pipe(first())
			.toPromise();
	}

	count(findInput): Promise<Number> {
		const data = JSON.stringify(findInput);
		return this.http
			.get<number>(
				`${this.PRODUCT_TYPES_URL}/count`,
				{
					params: { data }
				}
			)
			.pipe(first())
			.toPromise();
	}

	getAll(
		options,
		params
	): Promise<{ items: IProductTypeTranslatable[] }> {
		const data = JSON.stringify(options);

		return this.http
			.get<{ items: IProductTypeTranslatable[] }>(
				this.PRODUCT_TYPES_URL,
				{ params: { data, ...params } }
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
