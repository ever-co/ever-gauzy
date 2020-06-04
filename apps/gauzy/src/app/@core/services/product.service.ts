import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { first } from 'rxjs/operators';
import { Product, ProductFindInput, IProductCreateInput } from '@gauzy/models';

@Injectable()
export class ProductService {
	PRODUCTS_URL = '/api/products';

	constructor(private http: HttpClient) {}

	getAll(
		relations?: string[],
		findInput?: ProductFindInput,
		languageCode?: string
	): Promise<{ items: Product[] }> {
		const data = JSON.stringify({ relations, findInput });
		return this.http
			.get<{ items: Product[] }>(
				`${this.PRODUCTS_URL}/local/${languageCode}`,
				{
					params: { data }
				}
			)
			.pipe(first())
			.toPromise();
	}

	getById(id: string) {
		return this.http
			.get<Product>(`${this.PRODUCTS_URL}/${id}`)
			.pipe(first())
			.toPromise();
	}

	create(product: IProductCreateInput): Promise<Product> {
		return this.http
			.post<Product>(`${this.PRODUCTS_URL}/create`, product)
			.pipe(first())
			.toPromise();
	}

	update(product: Product): Promise<Product> {
		return this.http
			.put<Product>(`${this.PRODUCTS_URL}/${product.id}`, product)
			.pipe(first())
			.toPromise();
	}

	delete(id: string): Promise<any> {
		return this.http
			.delete(`${this.PRODUCTS_URL}/${id}`)
			.pipe(first())
			.toPromise();
	}
}
