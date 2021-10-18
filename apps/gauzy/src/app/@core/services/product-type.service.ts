import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { firstValueFrom } from 'rxjs';
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
		return firstValueFrom(
			this.http
			.get<IProductTypeTranslatable>(`${this.PRODUCT_TYPES_URL}/${id}`)
		);
	}

	count(findInput): Promise<Number> {
		const data = JSON.stringify(findInput);
		return firstValueFrom(
			this.http
			.get<number>(
				`${this.PRODUCT_TYPES_URL}/count`,
				{
					params: { data }
				}
			)
		);
	}

	getAll(
		options,
		params
	): Promise<{ items: IProductTypeTranslatable[] }> {
		const data = JSON.stringify(options);
		return firstValueFrom(
			this.http
			.get<{ items: IProductTypeTranslatable[] }>(
				this.PRODUCT_TYPES_URL,
				{ params: { data, ...params } }
			)
		);
	}

	getAllTranslated(
		langCode: string,
		relations?: string[],
		findInput?: any
	): Promise<{ items: IProductTypeTranslated[] }> {
		const data = JSON.stringify({ relations, findInput, langCode });
		return firstValueFrom(
			this.http
			.get<{ items: IProductTypeTranslated[] }>(
				`${this.PRODUCT_TYPES_URL}`,
				{
					params: { data }
				}
			)
		);
	}

	create(
		productTypeRequest: IProductTypeTranslatable
	): Promise<IProductTypeTranslatable> {
		return firstValueFrom(
			this.http
			.post<IProductTypeTranslatable>(
				`${this.PRODUCT_TYPES_URL}`,
				productTypeRequest
			)
		);
	}

	update(
		productTypeRequest: IProductTypeTranslatable
	): Promise<IProductTypeTranslatable> {
		return firstValueFrom(
			this.http
			.put<IProductTypeTranslatable>(
				`${this.PRODUCT_TYPES_URL}/${productTypeRequest.id}`,
				productTypeRequest
			)
		);
	}

	delete(id: string): Promise<IProductTypeTranslatable> {
		return firstValueFrom(
			this.http
			.delete<IProductTypeTranslatable>(`${this.PRODUCT_TYPES_URL}/${id}`)
		);
	}
}
