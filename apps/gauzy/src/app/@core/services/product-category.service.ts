import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { ProductCategory } from '@gauzy/models';
import { first } from 'rxjs/operators';

@Injectable()
export class ProductCategoryService {
	PRODUCT_CATEGORY_URL = '/api/product-categories';

	constructor(private http: HttpClient) {}

	getAll(findInput?: any): Promise<{ items: ProductCategory[] }> {
		return this.http
			.get<{ items: ProductCategory[] }>(this.PRODUCT_CATEGORY_URL, {
				params: findInput
			})
			.pipe(first())
			.toPromise();
	}
}
