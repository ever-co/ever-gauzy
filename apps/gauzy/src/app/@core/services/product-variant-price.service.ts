import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { ProductVariantPrice } from '@gauzy/models';
import { first } from 'rxjs/operators';

@Injectable()
export class ProductVariantPriceService {
	PRODUCT_VARIANT_PRICE_URL = '/api/product-variant-prices';

	constructor(private http: HttpClient) {}

	updateProductVariantPrice(
		productVariantPrice: ProductVariantPrice
	): Promise<ProductVariantPrice> {
		return this.http
			.put<ProductVariantPrice>(
				`${this.PRODUCT_VARIANT_PRICE_URL}/${productVariantPrice.id}`,
				productVariantPrice
			)
			.pipe(first())
			.toPromise();
	}
}
