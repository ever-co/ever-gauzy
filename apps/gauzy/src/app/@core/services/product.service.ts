import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { first } from 'rxjs/operators';
import { Product } from '@gauzy/models';

@Injectable()
export class ProductService {
	PRODUCTS_URL = '/api/products';

	constructor(private http: HttpClient) {}

	getAll(): Promise<{ items: Product[] }> {
		return this.http
			.get<{ items: Product[] }>(this.PRODUCTS_URL)
			.pipe(first())
			.toPromise();
	}

	create(product: Product): Promise<Product> {		
		return this.http
			.post<Product>(this.PRODUCTS_URL, product)
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
