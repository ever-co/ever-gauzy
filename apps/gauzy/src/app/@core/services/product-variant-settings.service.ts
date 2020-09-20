import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { IProductVariantSetting } from '@gauzy/models';
import { first } from 'rxjs/operators';

@Injectable()
export class ProductVariantSettingsService {
	PRODUCT_VARIANT_SETTINGS_URL = '/api/product-variant-settings';

	constructor(private http: HttpClient) {}

	updateProductVariantSettings(
		productVariantSettings: IProductVariantSetting
	): Promise<IProductVariantSetting> {
		return this.http
			.put<IProductVariantSetting>(
				`${this.PRODUCT_VARIANT_SETTINGS_URL}/${productVariantSettings.id}`,
				productVariantSettings
			)
			.pipe(first())
			.toPromise();
	}

	getProductVariantSettings(): Promise<IProductVariantSetting[]> {
		return this.http
			.get<IProductVariantSetting[]>(this.PRODUCT_VARIANT_SETTINGS_URL)
			.pipe(first())
			.toPromise();
	}
}
