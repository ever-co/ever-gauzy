import { Injectable } from '@angular/core';
import { IProductVariant, IVariantCreateInput, IPagination } from '@gauzy/contracts';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { API_PREFIX } from '@gauzy/ui-core/common';

@Injectable()
export class ProductVariantService {
	PRODUCT_VARIANTS_URL = `${API_PREFIX}/product-variants`;

	constructor(private http: HttpClient) {}

	getVariantsByProductId(productId: string): Promise<IPagination<IProductVariant>> {
		return firstValueFrom(
			this.http.get<IPagination<IProductVariant>>(`${this.PRODUCT_VARIANTS_URL}/product/${productId}`)
		);
	}

	getProductVariant(id: string): Promise<IProductVariant> {
		return firstValueFrom(this.http.get<IProductVariant>(`${this.PRODUCT_VARIANTS_URL}/${id}`));
	}

	createProductVariants(variantCreateInput: IVariantCreateInput): Promise<IProductVariant[]> {
		return firstValueFrom(
			this.http.post<IProductVariant[]>(`${this.PRODUCT_VARIANTS_URL}/variants`, variantCreateInput)
		);
	}

	updateProductVariant(productVariant: IProductVariant): Promise<IProductVariant> {
		return firstValueFrom(
			this.http.put<IProductVariant>(`${this.PRODUCT_VARIANTS_URL}/${productVariant.id}`, productVariant)
		);
	}

	delete(id: string): Promise<any> {
		return firstValueFrom(this.http.delete(`${this.PRODUCT_VARIANTS_URL}/${id}`));
	}

	deleteFeaturedImage(id: string): Promise<any> {
		return firstValueFrom(this.http.delete(`${this.PRODUCT_VARIANTS_URL}/featured-image/${id}`));
	}
}
