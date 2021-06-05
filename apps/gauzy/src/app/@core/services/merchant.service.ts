import { Injectable } from '@angular/core';
import { API_PREFIX } from '../constants/app.constants';
import {
	IMerchant,
} from '@gauzy/contracts';
import { first } from 'rxjs/operators';
import { HttpClient } from '@angular/common/http';


@Injectable()
export class MerchantService {
	MERCHANTS_URL = `${API_PREFIX}/merchants`;

	constructor(private http: HttpClient) { }

	getById(id: string, relations?: string[]): Promise<IMerchant> {
		const data = JSON.stringify({ relations });

		return this.http
			.get<IMerchant>(
				`${this.MERCHANTS_URL}/${id}`,
				{
					params: { data }
				}
			)
			.pipe(first())
			.toPromise();
	}

	getAll(options, params) {
		const data = JSON.stringify({
			relations: options.relations,
			findInput: options.findInput
		});

		return this.http
			.get<{ items: IMerchant[] }>(
				`${this.MERCHANTS_URL}`,
				{ params: { data, ...params } }
			)
			.pipe(first())
			.toPromise();
	}

	count(findInput): Promise<Number> {
		const data = JSON.stringify(findInput);
		return this.http
			.get<number>(
				`${this.MERCHANTS_URL}/count`,
				{
					params: { data }
				}
			)
			.pipe(first())
			.toPromise();
	}

	create(
		productStore: IMerchant
	): Promise<IMerchant> {
		return this.http
			.post<IMerchant>(
				`${this.MERCHANTS_URL}`,
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
				`${this.MERCHANTS_URL}/${productStore.id}`,
				productStore
			)
			.pipe(first())
			.toPromise();
	}

	delete(id: string): Promise<IMerchant> {
		return this.http
			.delete<IMerchant>(
				`${this.MERCHANTS_URL}/${id}`
			)
			.pipe(first())
			.toPromise();
	}

}