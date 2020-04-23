import { Injectable } from '@angular/core';
import { ProductVariant, Product } from '@gauzy/models';
import { HttpClient } from '@angular/common/http';
import { first } from 'rxjs/operators';

@Injectable()
export class ProductVariantService {
	PRODUCT_VARIANTS_URL = '/api/product-variants';

	constructor(private http: HttpClient) {}

	createProductVariants(product: Product): Promise<ProductVariant[]> {
		return this.http
			.post<ProductVariant[]>(
				`${this.PRODUCT_VARIANTS_URL}/create-variants`,
				product
			)
			.pipe(first())
			.toPromise();
	}
}
