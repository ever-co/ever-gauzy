// src/app/permissions.service.ts
import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { NgxPermissionsService } from 'ngx-permissions';
import { firstValueFrom } from 'rxjs';
import { IPagination, IRolePermission } from '@gauzy/contracts';
import { API_PREFIX, Store } from '@gauzy/ui-core/common';

@Injectable({
	providedIn: 'root'
})
export class PermissionsService {
	constructor(
		private readonly _http: HttpClient,
		private readonly _ngxPermissionsService: NgxPermissionsService,
		private readonly _store: Store
	) {}

	/**
	 * Loads the permissions asynchronously.
	 *
	 * @return {Promise<void>} A promise that resolves when the permissions are loaded.
	 */
	async loadPermissions(): Promise<void> {
		if (this._store.user) {
			let rolPermissions = (await this.getPermissions()).items;
			this._store.userRolePermissions = rolPermissions;

			const permissions = rolPermissions.map(({ permission }) => permission);
			this._ngxPermissionsService.flushPermissions();
			this._ngxPermissionsService.loadPermissions(permissions);
		}
	}

	/**
	 * Retrieves the permissions for the current user.
	 *
	 * @return {Promise<IPagination<IRolePermission>>} A promise that resolves to the pagination of the role permissions.
	 */
	async getPermissions(): Promise<IPagination<IRolePermission>> {
		return firstValueFrom(this._http.get<IPagination<IRolePermission>>(`${API_PREFIX}/role-permissions/me`));
	}

	/**
	 * Refreshes the permissions.
	 *
	 * @return {Promise<void>} A promise that resolves when the permissions are refreshed.
	 */
	async refreshPermissions(): Promise<void> {
		await this.loadPermissions().then(() => {});
	}
}
