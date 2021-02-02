import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { IProductVariantPrice } from '@gauzy/contracts';
import { first } from 'rxjs/operators';
import { API_PREFIX } from '../constants/app.constants';

@Injectable()
export class ProductVariantPriceService {
	PRODUCT_VARIANT_PRICE_URL = `${API_PREFIX}/product-variant-prices`;

	constructor(private http: HttpClient) {}

	updateProductVariantPrice(
		productVariantPrice: IProductVariantPrice
	): Promise<IProductVariantPrice> {
		return this.http
			.put<IProductVariantPrice>(
				`${this.PRODUCT_VARIANT_PRICE_URL}/${productVariantPrice.id}`,
				productVariantPrice
			)
			.pipe(first())
			.toPromise();
	}
}
