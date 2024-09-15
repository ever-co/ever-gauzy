// src/app/permissions.service.ts
import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { NgxPermissionsService } from 'ngx-permissions';
import { firstValueFrom } from 'rxjs';
import { IRolePermissions } from '@gauzy/contracts';
import { API_PREFIX } from '@gauzy/ui-core/common';
import { Store } from '../store/store.service';
import { ErrorHandlingService } from '../notification/error-handling.service';

@Injectable({
	providedIn: 'root'
})
export class PermissionsService {
	constructor(
		private readonly _http: HttpClient,
		private readonly _ngxPermissionsService: NgxPermissionsService,
		private readonly _store: Store,
		private readonly _errorHandlingService: ErrorHandlingService
	) {}

	/**
	 * Loads the permissions asynchronously and updates the user's role permissions in the store.
	 *
	 * @return {Promise<void>} A promise that resolves when the permissions are loaded.
	 */
	async loadPermissions(): Promise<void> {
		if (!this._store.userId) return;

		try {
			// Fetch role permissions and update the store
			const rolePermissions = await this.getPermissions();
			this._store.userRolePermissions = rolePermissions;

			// Extract and load permissions into the permissions service
			const permissions = rolePermissions.map(({ permission }) => permission);
			this._ngxPermissionsService.flushPermissions();
			this._ngxPermissionsService.loadPermissions(permissions);
		} catch (error) {
			console.log('Error while loading permissions:', error);
			this._errorHandlingService.handleError(error);
		}
	}

	/**
	 * Retrieves the permissions for the current user.
	 *
	 * @return {Promise<IRolePermissions>} A promise that resolves to the pagination of the role permissions.
	 */
	async getPermissions(): Promise<IRolePermissions> {
		return firstValueFrom(this._http.get<IRolePermissions>(`${API_PREFIX}/role-permissions/me`));
	}
}
