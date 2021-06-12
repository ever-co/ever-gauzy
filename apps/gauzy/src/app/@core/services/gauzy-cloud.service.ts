import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { ITenantCreateInput, IUserRegistrationInput } from '@gauzy/contracts';
import { API_PREFIX } from '../constants';

@Injectable({
	providedIn: 'root'
})
export class GauzyCloudService {

	constructor(
		private readonly _http: HttpClient
	) {}

	migrateIntoCloud(payload: IUserRegistrationInput) {
		return this._http.post(`${API_PREFIX}/cloud/migrate`, payload);
	}

	migrateTenant(payload: ITenantCreateInput, token: string) {
		return this._http.post(`${API_PREFIX}/cloud/migrate/tenant/${token}`, {
			...payload
		});
	}
}