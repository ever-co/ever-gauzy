import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { IPagination, IUser, IUserOrganization, IUserOrganizationFindInput, IUserUpdateInput } from '@gauzy/contracts';
import { toParams } from '@gauzy/ui-sdk/common';
import { firstValueFrom, map, shareReplay } from 'rxjs';
import { OrganizationsCacheService } from '../../services/organizations-cache.service';
import { UserOrganizationCacheService } from '../../services/user-organization-cache.service';
import { API_PREFIX } from '../../constants/app.constants';

@Injectable({
	providedIn: 'root'
})
export class UserOrganizationService {
	constructor(
		private readonly _userOrganizationsCacheService: OrganizationsCacheService,
		private readonly _userOrganizationCacheService: UserOrganizationCacheService,
		private readonly _http: HttpClient
	) {}

	/**
	 * Fetches all user organizations with optional relations, where conditions, and inclusion of employee information.
	 *
	 * @param relations Optional array of relation names to include.
	 * @param where Optional filtering conditions.
	 * @param includeEmployee Whether to include employee information.
	 * @returns A promise resolving to an object with `items` and `total` representing user organizations and total count.
	 */
	public async getAll(
		relations: string[] = [],
		where?: IUserOrganizationFindInput,
		includeEmployee: boolean = false
	): Promise<IPagination<IUserOrganization>> {
		// Construct request parameters
		const params = { relations, where, includeEmployee };

		// Get cached observable for user organizations
		let usersOrganizations$ = this._userOrganizationsCacheService.getValue('all');

		if (!usersOrganizations$) {
			// If no cached observable, fetch from the server
			usersOrganizations$ = this._http
				.get<IPagination<IUserOrganization>>(`${API_PREFIX}/user-organization`, {
					params: toParams(params)
				})
				.pipe(
					map((response: any) => response), // Map to ensure correct data handling
					shareReplay(1) // Cache the result for future use
				);

			// Store the observable in the cache
			this._userOrganizationsCacheService.setValue(usersOrganizations$, 'all');
		}

		// Convert observable to promise and return
		return await firstValueFrom(usersOrganizations$);
	}

	/**
	 * Retrieves detailed information about the current user's details.
	 *
	 * @returns {Promise<IUser>} The user me details.
	 */
	public async detail(): Promise<IUser> {
		// Check if the user organization details are already cached
		let user$ = this._userOrganizationCacheService.getValue('me');

		// If not cached, fetch the details from the server
		if (!user$) {
			const params = toParams({
				relations: ['tenant', 'role', 'role.rolePermissions'],
				includeEmployee: true,
				includeOrganization: true
			});

			user$ = this._http.get<IUser>(`${API_PREFIX}/user/me`, { params }).pipe(
				map((response: any) => response),
				shareReplay(1)
			);

			// Cache the fetched user organization details
			this._userOrganizationCacheService.setValue(user$, 'me');
		}

		// Return the first value from the observable
		return firstValueFrom(user$);
	}

	public async updatePreferredLanguage(input: IUserUpdateInput): Promise<void> {
		await firstValueFrom(this._http.put(`${API_PREFIX}/user/preferred-language`, input));
	}
}
