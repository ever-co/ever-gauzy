import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { ITenant, ITenantCreateInput, ITenantSetting } from '@gauzy/contracts';
import { API_PREFIX } from '@gauzy/ui-core/common';

@Injectable()
export class TenantService {
	constructor(private readonly http: HttpClient) {}

	API_URL = `${API_PREFIX}/tenant`;

	/**
	 * Creates a new tenant using the provided input.
	 *
	 * @param {ITenantCreateInput} input - The input data required to create a new tenant.
	 * @returns {Promise<ITenant>} - A promise that resolves to the created tenant.
	 */
	create(input: ITenantCreateInput): Promise<ITenant> {
		return firstValueFrom(this.http.post<ITenant>(`${this.API_URL}`, input));
	}

	/**
	 * Retrieves the settings for the tenant.
	 *
	 * @returns {Promise<ITenantSetting>} - A promise that resolves to the tenant settings.
	 */
	getSettings(): Promise<ITenantSetting> {
		return firstValueFrom(this.http.get<ITenantSetting>(`${API_PREFIX}/tenant-setting`));
	}

	/**
	 * Saves the provided tenant settings.
	 *
	 * @param {ITenantSetting} request - The tenant settings to be saved.
	 * @returns {Promise<ITenantSetting>} - A promise that resolves to the saved tenant settings.
	 */
	saveSettings(request: ITenantSetting): Promise<ITenantSetting> {
		return firstValueFrom(this.http.post<ITenantSetting>(`${API_PREFIX}/tenant-setting`, request));
	}
}
