import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { ProductType } from '@gauzy/models';
import { first } from 'rxjs/operators';

@Injectable()
export class ProductTypeService {
	PRODUCT_TYPES_URL = '/api/product-types';

	constructor(private http: HttpClient) {}

	getAll(findInput?: any): Promise<{ items: ProductType[] }> {
		return this.http
			.get<{ items: ProductType[] }>(this.PRODUCT_TYPES_URL, {
				params: findInput
			})
			.pipe(first())
			.toPromise();
	}
}
