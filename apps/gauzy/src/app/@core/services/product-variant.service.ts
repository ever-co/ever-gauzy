import { Injectable } from '@angular/core';
import { ProductVariant, IVariantCreateInput } from '@gauzy/models';
import { HttpClient } from '@angular/common/http';
import { first } from 'rxjs/operators';

@Injectable()
export class ProductVariantService {
	PRODUCT_VARIANTS_URL = '/api/product-variants';

	constructor(private http: HttpClient) {}

	getProductVariant(id: string): Promise<ProductVariant> {
		return this.http
			.get<ProductVariant>(`${this.PRODUCT_VARIANTS_URL}/${id}`)
			.pipe(first())
			.toPromise();
	}

	createProductVariants(
		variantCreateInput: IVariantCreateInput
	): Promise<ProductVariant[]> {
		return this.http
			.post<ProductVariant[]>(
				`${this.PRODUCT_VARIANTS_URL}/create-variants`,
				variantCreateInput
			)
			.pipe(first())
			.toPromise();
	}

	updateProductVariant(
		productVariant: ProductVariant
	): Promise<ProductVariant> {
		return this.http
			.put<ProductVariant>(
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
}
