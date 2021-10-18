import { Injectable } from '@angular/core';
import { API_PREFIX } from '../constants/app.constants';
import {
	IMerchant,
} from '@gauzy/contracts';
import { firstValueFrom } from 'rxjs';
import { HttpClient } from '@angular/common/http';


@Injectable()
export class MerchantService {
	MERCHANTS_URL = `${API_PREFIX}/merchants`;

	constructor(private http: HttpClient) { }

	getById(id: string, relations?: string[]): Promise<IMerchant> {
		const data = JSON.stringify({ relations });
		return firstValueFrom(
			this.http
			.get<IMerchant>(
				`${this.MERCHANTS_URL}/${id}`,
				{
					params: { data }
				}
			)
		);
	}

	getAll(options, params) {
		const data = JSON.stringify({
			relations: options.relations,
			findInput: options.findInput
		});
		return firstValueFrom(
			this.http
			.get<{ items: IMerchant[] }>(
				`${this.MERCHANTS_URL}`,
				{ params: { data, ...params } }
			)
		);
	}

	count(findInput): Promise<Number> {
		const data = JSON.stringify(findInput);
		return firstValueFrom(
			this.http
			.get<number>(
				`${this.MERCHANTS_URL}/count`,
				{
					params: { data }
				}
			)
		);
	}

	create(
		productStore: IMerchant
	): Promise<IMerchant> {
		return firstValueFrom(
			this.http
			.post<IMerchant>(
				`${this.MERCHANTS_URL}`,
				productStore
			)
		);
	}

	update(
		productStore: IMerchant
	): Promise<IMerchant> {
		return firstValueFrom(
			this.http
			.put<IMerchant>(
				`${this.MERCHANTS_URL}/${productStore.id}`,
				productStore
			)
		);
	}

	delete(id: string): Promise<IMerchant> {
		return firstValueFrom(
			this.http
			.delete<IMerchant>(
				`${this.MERCHANTS_URL}/${id}`
			)
		);
	}

}