import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { ProductType } from '@gauzy/models';
import { first } from 'rxjs/operators';

@Injectable()
export class ProductTypeService {
	PRODUCT_TYPES_URL = '/api/product-types';

	constructor(private http: HttpClient) {}

	getAll(
		relations?: string[],
		findInput?: any
	): Promise<{ items: ProductType[] }> {
		const data = JSON.stringify({ relations, findInput });
		return this.http
			.get<{ items: ProductType[] }>(this.PRODUCT_TYPES_URL, {
				params: { data }
			})
			.pipe(first())
			.toPromise();
	}

	create(productTypeRequest: ProductType): Promise<ProductType> {
		return this.http
			.post<ProductType>(`${this.PRODUCT_TYPES_URL}`, productTypeRequest)
			.pipe(first())
			.toPromise();
	}

	update(productTypeRequest: ProductType): Promise<ProductType> {
		return this.http
			.put<ProductType>(
				`${this.PRODUCT_TYPES_URL}/${productTypeRequest.id}`,
				productTypeRequest
			)
			.pipe(first())
			.toPromise();
	}

	delete(id: string): Promise<ProductType> {
		return this.http
			.delete<ProductType>(`${this.PRODUCT_TYPES_URL}/${id}`)
			.pipe(first())
			.toPromise();
	}
}
