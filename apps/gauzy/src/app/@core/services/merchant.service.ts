import { Injectable } from '@angular/core';
import { API_PREFIX } from '../constants/app.constants';
import {
	IMerchant,
} from '@gauzy/contracts';
import { first } from 'rxjs/operators';
import { HttpClient } from '@angular/common/http';


@Injectable()
export class MerchantService {
	PRODUCT_STORES_URL = `${API_PREFIX}/merchants`;

	constructor(private http: HttpClient) { }

	getById(id: string): Promise<IMerchant> {
		return this.http
			.get<IMerchant>(
				`${this.PRODUCT_STORES_URL}/${id}`
			)
			.pipe(first())
			.toPromise();
	}

	create(
		productStore: IMerchant
	): Promise<IMerchant> {
		return this.http
			.post<IMerchant>(
				`${this.PRODUCT_STORES_URL}`,
				productStore
			)
			.pipe(first())
			.toPromise();
	}

	update(
		productStore: IMerchant
	): Promise<IMerchant> {
		return this.http
			.put<IMerchant>(
				`${this.PRODUCT_STORES_URL}/${productStore.id}`,
				productStore
			)
			.pipe(first())
			.toPromise();
	}

	delete(id: string): Promise<IMerchant> {
		return this.http
			.delete<IMerchant>(
				`${this.PRODUCT_STORES_URL}/${id}`
			)
			.pipe(first())
			.toPromise();
	}

}