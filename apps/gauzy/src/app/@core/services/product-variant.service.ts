import { Injectable } from '@angular/core';
import { IProductVariant, IVariantCreateInput, IPagination } from '@gauzy/contracts';
import { HttpClient } from '@angular/common/http';
import { first } from 'rxjs/operators';
import { API_PREFIX } from '../constants/app.constants';

@Injectable()
export class ProductVariantService {
	PRODUCT_VARIANTS_URL = `${API_PREFIX}/product-variants`;

	constructor(private http: HttpClient) {}

	getVariantsByProductId(productId: string): Promise<IPagination<IProductVariant>> {
		return this.http
			.get<IPagination<IProductVariant>>(`${this.PRODUCT_VARIANTS_URL}/product/${productId}`)
			.pipe(first())
			.toPromise();
	}

	getProductVariant(id: string): Promise<IProductVariant> {
		return this.http
			.get<IProductVariant>(`${this.PRODUCT_VARIANTS_URL}/${id}`)
			.pipe(first())
			.toPromise();
	}

	createProductVariants(
		variantCreateInput: IVariantCreateInput
	): Promise<IProductVariant[]> {
		return this.http
			.post<IProductVariant[]>(
				`${this.PRODUCT_VARIANTS_URL}/variants`,
				variantCreateInput
			)
			.pipe(first())
			.toPromise();
	}

	updateProductVariant(
		productVariant: IProductVariant
	): Promise<IProductVariant> {
		return this.http
			.put<IProductVariant>(
				`${this.PRODUCT_VARIANTS_URL}/${productVariant.id}`,
				productVariant
			)
			.pipe(first())
			.toPromise();
	}

	delete(id: string): Promise<any> {
		return this.http
			.delete(`${this.PRODUCT_VARIANTS_URL}/${id}`)
			.pipe(first())
			.toPromise();
	}

	deleteFeaturedImage(id: string): Promise<any> {
		return this.http
			.delete(`${this.PRODUCT_VARIANTS_URL}/featured-image/${id}`)
			.pipe(first())
			.toPromise();
	}
}
