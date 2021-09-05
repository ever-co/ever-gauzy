import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { IProductVariantSetting } from '@gauzy/contracts';
import { first } from 'rxjs/operators';
import { API_PREFIX } from '../constants/app.constants';

@Injectable()
export class ProductVariantSettingService {
	PRODUCT_VARIANT_SETTINGS_URL = `${API_PREFIX}/product-variant-settings`;

	constructor(private http: HttpClient) {}

	updateProductVariantSetting(
		productVariantSetting: IProductVariantSetting
	): Promise<IProductVariantSetting> {
		return this.http
			.put<IProductVariantSetting>(
				`${this.PRODUCT_VARIANT_SETTINGS_URL}/${productVariantSetting.id}`,
				productVariantSetting
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
