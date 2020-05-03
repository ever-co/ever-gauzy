import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { ProductVariantSettings } from '@gauzy/models';
import { first } from 'rxjs/operators';

@Injectable()
export class ProductVariantSettingsService {
	PRODUCT_VARIANT_SETTINGS_URL = '/api/product-variant-settings';

	constructor(private http: HttpClient) {}

	updateProductVariantSettings(
		productVariantSettings: ProductVariantSettings
	): Promise<ProductVariantSettings> {
		return this.http
			.put<ProductVariantSettings>(
				`${this.PRODUCT_VARIANT_SETTINGS_URL}/${productVariantSettings.id}`,
				productVariantSettings
			)
			.pipe(first())
			.toPromise();
	}

	getProductVariantSettings(): Promise<ProductVariantSettings[]> {
		return this.http
			.get<ProductVariantSettings[]>(this.PRODUCT_VARIANT_SETTINGS_URL)
			.pipe(first())
			.toPromise();
	}
}
