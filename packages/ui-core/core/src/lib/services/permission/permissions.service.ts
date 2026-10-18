// src/app/permissions.service.ts
import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { NgxPermissionsService } from 'ngx-permissions';
import { firstValueFrom } from 'rxjs';
import { IRolePermissions } from '@gauzy/contracts';
import { API_PREFIX } from '@gauzy/ui-core/common';
import { Store } from '../store/store.service';
import { ErrorHandlingService } from '../notification/error-handling.service';
import { cloneJson, RecentAnswers } from '../recent-answers';

/**
 * How long an answer of `GET /role-permissions/me` (~164 KB) is reused for the same user and token. The app loads
 * the permissions from `AppInitService` and again from the pages entry point as it starts, and `loadPermissions`
 * is called once more after sign-in and organization switches; the rows are the same each time. A change to the
 * role's permissions is picked up by the next load after the window, or at once after {@link
 * PermissionsService.forgetPermissions}.
 */
export const PERMISSIONS_REUSE_WINDOW_MS = 10_000;

@Injectable({
	providedIn: 'root'
})
export class PermissionsService {
	private readonly recentPermissions = new RecentAnswers<IRolePermissions>(PERMISSIONS_REUSE_WINDOW_MS);

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
	 * Retrieves the permissions for the current user. An identical request made within
	 * {@link PERMISSIONS_REUSE_WINDOW_MS} of the previous one is answered from that one.
	 *
	 * @return {Promise<IRolePermissions>} A promise that resolves to the pagination of the role permissions.
	 */
	async getPermissions(): Promise<IRolePermissions> {
		const key = `${this._store.userId ?? ''}|${this._store.token ?? ''}`;
		return (
			this.recentPermissions
				.get(key, () => firstValueFrom(this._http.get<IRolePermissions>(`${API_PREFIX}/role-permissions/me`)))
				// Each caller gets its own copy of the rows.
				.then(cloneJson)
		);
	}

	/** Forgets the recent answers of {@link getPermissions}: the next load asks the API again. */
	forgetPermissions(): void {
		this.recentPermissions.forget();
	}
}
