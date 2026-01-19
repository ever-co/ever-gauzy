import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { ITenant, ITenantCreateInput, ITenantSetting } from '@gauzy/contracts';
import { API_PREFIX } from '@gauzy/ui-core/common';

@Injectable()
export class TenantService {
	constructor(private readonly http: HttpClient) {}

	API_URL = `${API_PREFIX}/tenant`;
	SETTING_API_URL = `${API_PREFIX}/tenant-setting`;

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
	 * Retrieves the settings for the current tenant.
	 *
	 * @returns {Promise<ITenantSetting>} - A promise that resolves to the tenant settings.
	 */
	getSettings(): Promise<ITenantSetting> {
		return firstValueFrom(this.http.get<ITenantSetting>(`${this.SETTING_API_URL}`));
	}

	/**
	 * Saves the provided tenant settings for the current tenant.
	 * Used for file storage settings that require fileStorageProvider.
	 *
	 * @param {ITenantSetting} request - The tenant settings to be saved.
	 * @returns {Promise<ITenantSetting>} - A promise that resolves to the saved tenant settings.
	 */
	saveSettings(request: ITenantSetting): Promise<ITenantSetting> {
		return firstValueFrom(this.http.post<ITenantSetting>(`${this.SETTING_API_URL}`, request));
	}

	/**
	 * Saves dynamic tenant settings (any key-value pairs).
	 * Used for monitoring settings (PostHog, Sentry) and other dynamic configurations.
	 *
	 * @param {ITenantSetting} request - The dynamic settings to be saved.
	 * @returns {Promise<ITenantSetting>} - A promise that resolves to the saved settings.
	 */
	saveDynamicSettings(request: ITenantSetting): Promise<ITenantSetting> {
		return firstValueFrom(this.http.post<ITenantSetting>(`${this.SETTING_API_URL}/dynamic`, request));
	}

	/**
	 * Retrieves global settings (tenantId = NULL).
	 *
	 * @returns {Promise<Record<string, string>>} - A promise that resolves to the global settings.
	 */
	getGlobalSettings(): Promise<Record<string, string>> {
		return firstValueFrom(this.http.get<Record<string, string>>(`${this.SETTING_API_URL}/global`));
	}

	/**
	 * Saves global settings (tenantId = NULL).
	 *
	 * @param {ITenantSetting} request - The global settings to be saved.
	 * @returns {Promise<ITenantSetting>} - A promise that resolves to the saved global settings.
	 */
	saveGlobalSettings(request: ITenantSetting): Promise<ITenantSetting> {
		return firstValueFrom(this.http.post<ITenantSetting>(`${this.SETTING_API_URL}/global`, request));
	}
}
