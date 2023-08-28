import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import {
	IUserOrganization,
	IUserOrganizationFindInput,
	IUserUpdateInput,
} from '@gauzy/contracts';
import { toParams } from '@gauzy/common-angular';
import { firstValueFrom, map, shareReplay } from 'rxjs';
import { OrganizationsCacheService } from '../../services/organizations-cache.service';
import { UserOrganizationCacheService } from '../../services/user-organization-cache.service';
import { API_PREFIX } from '../../constants/app.constants';

@Injectable({
	providedIn: 'root',
})
export class UserOrganizationService {
	constructor(
		private readonly _userOrganizationsCacheService: OrganizationsCacheService,
		private readonly _userOrganizationCacheService: UserOrganizationCacheService,
		private readonly _http: HttpClient
	) {}

	public all(
		relations?: string[],
		findInput?: IUserOrganizationFindInput
	): Promise<{ items: IUserOrganization[]; total: number }> {
		const data = JSON.stringify({ relations, findInput });
		let usersOrganizations$ =
			this._userOrganizationsCacheService.getValue('all');
		if (!usersOrganizations$) {
			usersOrganizations$ = this._http
				.get<{
					items: IUserOrganization[];
					total: number;
				}>(`${API_PREFIX}/user-organization`, {
					params: { data }
				})
				.pipe(
					map((response: any) => response),
					shareReplay(1)
				);
			this._userOrganizationsCacheService.setValue(
				usersOrganizations$,
				'all'
			);
		}
		return firstValueFrom(usersOrganizations$);
	}

	public async detail(): Promise<IUserOrganization> {
		const params = toParams({
			relations: [
				'tenant',
				'employee',
				'employee.organization',
				'role',
				'role.rolePermissions',
			],
		});
		let userOrganizations$ =
			this._userOrganizationCacheService.getValue('me');
		if (!userOrganizations$) {
			userOrganizations$ = this._http
				.get<IUserOrganization>(`${API_PREFIX}/user/me`, {
					params
				})
				.pipe(
					map((response: any) => response),
					shareReplay(1)
				);
			this._userOrganizationCacheService.setValue(
				userOrganizations$,
				'me'
			);
		}
		return firstValueFrom(userOrganizations$);
	}

	public async updatePreferredLanguage(input: IUserUpdateInput): Promise<void> {
		await firstValueFrom(
			this._http.put(`${API_PREFIX}/user/preferred-language`, input)
		);
	}
}
