import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { IMerchant } from '@gauzy/contracts';
import { toParams } from '@gauzy/ui-sdk/common';
import { API_PREFIX } from '@gauzy/ui-sdk/common';

@Injectable({
	providedIn: 'root'
})
export class MerchantService {
	MERCHANTS_URL = `${API_PREFIX}/merchants`;

	constructor(private readonly http: HttpClient) {}

	getById(id: IMerchant['id'], relations: string[] = []): Promise<IMerchant> {
		return firstValueFrom(
			this.http.get<IMerchant>(`${this.MERCHANTS_URL}/${id}`, {
				params: toParams({ relations })
			})
		);
	}

	create(productStore: IMerchant): Promise<IMerchant> {
		return firstValueFrom(this.http.post<IMerchant>(`${this.MERCHANTS_URL}`, productStore));
	}

	update(productStore: IMerchant): Promise<IMerchant> {
		return firstValueFrom(this.http.put<IMerchant>(`${this.MERCHANTS_URL}/${productStore.id}`, productStore));
	}

	delete(id: IMerchant['id']): Promise<IMerchant> {
		return firstValueFrom(this.http.delete<IMerchant>(`${this.MERCHANTS_URL}/${id}`));
	}
}
