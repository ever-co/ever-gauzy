import { Injectable } from '@angular/core';
import { IProductVariant, IVariantCreateInput } from '@gauzy/models';
import { HttpClient } from '@angular/common/http';
import { first } from 'rxjs/operators';

@Injectable()
export class ProductVariantService {
	PRODUCT_VARIANTS_URL = '/api/product-variants';

	constructor(private http: HttpClient) {}

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
				`${this.PRODUCT_VARIANTS_URL}/create-variants`,
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
}
