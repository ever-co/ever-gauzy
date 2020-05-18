import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { ProductCategory } from '@gauzy/models';
import { first } from 'rxjs/operators';

@Injectable()
export class ProductCategoryService {
	PRODUCT_CATEGORY_URL = '/api/product-categories';

	constructor(private http: HttpClient) {}

	getAll(
		relations?: string[],
		findInput?: any
	): Promise<{ items: ProductCategory[] }> {
		const data = JSON.stringify({ relations, findInput });
		return this.http
			.get<{ items: ProductCategory[] }>(this.PRODUCT_CATEGORY_URL, {
				params: { data }
			})
			.pipe(first())
			.toPromise();
	}

	create(productTypeRequest: ProductCategory): Promise<ProductCategory> {
		return this.http
			.post<ProductCategory>(
				`${this.PRODUCT_CATEGORY_URL}`,
				productTypeRequest
			)
			.pipe(first())
			.toPromise();
	}

	update(productTypeRequest: ProductCategory): Promise<ProductCategory> {
		return this.http
			.put<ProductCategory>(
				`${this.PRODUCT_CATEGORY_URL}/${productTypeRequest.id}`,
				productTypeRequest
			)
			.pipe(first())
			.toPromise();
	}

	delete(id: string): Promise<ProductCategory> {
		return this.http
			.delete<ProductCategory>(`${this.PRODUCT_CATEGORY_URL}/${id}`)
			.pipe(first())
			.toPromise();
	}
}
