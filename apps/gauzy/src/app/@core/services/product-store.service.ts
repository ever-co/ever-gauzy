import { Injectable } from '@angular/core';
import { API_PREFIX } from '../constants/app.constants';
import {
	IProductStore,
} from '@gauzy/contracts';
import { first } from 'rxjs/operators';
import { HttpClient } from '@angular/common/http';


@Injectable()
export class ProductStoreService {
	PRODUCT_STORES_URL = `${API_PREFIX}/product-stores`;

    constructor(private http: HttpClient) {}

    getById(id: string): Promise<IProductStore> {
		return this.http
			.get<IProductStore>(
				`${this.PRODUCT_STORES_URL}/${id}`
			)
			.pipe(first())
			.toPromise();
    }
    
	create(
		productStore: IProductStore
	): Promise<IProductStore> {
		return this.http
			.post<IProductStore>(
				`${this.PRODUCT_STORES_URL}`,
				productStore
			)
			.pipe(first())
			.toPromise();
	}

	update(
		productStore: IProductStore
	): Promise<IProductStore> {
		return this.http
			.put<IProductStore>(
				`${this.PRODUCT_STORES_URL}/${productStore.id}`,
				productStore
			)
			.pipe(first())
			.toPromise();
	}

	delete(id: string): Promise<IProductStore> {
		return this.http
			.delete<IProductStore>(
				`${this.PRODUCT_STORES_URL}/${id}`
			)
			.pipe(first())
			.toPromise();
	}
    
}