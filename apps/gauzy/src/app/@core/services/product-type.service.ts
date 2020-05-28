import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { first } from 'rxjs/operators';
import { ProductTypeTranslatable, ProductTypeTranslated } from '@gauzy/models';

@Injectable()
export class ProductTypeService {
	PRODUCT_TYPES_URL = '/api/product-types';

	constructor(private http: HttpClient) {}

	getById(id: string = ''): Promise<ProductTypeTranslatable> {
		return this.http
			.get<ProductTypeTranslatable>(`${this.PRODUCT_TYPES_URL}/${id}`)
			.pipe(first())
			.toPromise();
	}

	getAll(
		relations?: string[],
		findInput?: any
	): Promise<{ items: ProductTypeTranslatable[] }> {
		const data = JSON.stringify({ relations, findInput });
		return this.http
			.get<{ items: ProductTypeTranslatable[] }>(this.PRODUCT_TYPES_URL, {
				params: { data },
			})
			.pipe(first())
			.toPromise();
	}

	getAllTranslated(
		langCode: string,
		relations?: string[],
		findInput?: any
	): Promise<{ items: ProductTypeTranslated[] }> {
		const data = JSON.stringify({ relations, findInput, langCode });
		return this.http
			.get<{ items: ProductTypeTranslated[] }>(
				`${this.PRODUCT_TYPES_URL}`,
				{
					params: { data },
				}
			)
			.pipe(first())
			.toPromise();
	}

	create(
		productTypeRequest: ProductTypeTranslatable
	): Promise<ProductTypeTranslatable> {
		return this.http
			.post<ProductTypeTranslatable>(
				`${this.PRODUCT_TYPES_URL}`,
				productTypeRequest
			)
			.pipe(first())
			.toPromise();
	}

	update(
		productTypeRequest: ProductTypeTranslatable
	): Promise<ProductTypeTranslatable> {
		return this.http
			.put<ProductTypeTranslatable>(
				`${this.PRODUCT_TYPES_URL}/${productTypeRequest.id}`,
				productTypeRequest
			)
			.pipe(first())
			.toPromise();
	}

	delete(id: string): Promise<ProductTypeTranslatable> {
		return this.http
			.delete<ProductTypeTranslatable>(`${this.PRODUCT_TYPES_URL}/${id}`)
			.pipe(first())
			.toPromise();
	}
}
