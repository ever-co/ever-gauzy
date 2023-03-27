import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import {
	IUserOrganization,
	IUserOrganizationFindInput,
} from '@gauzy/contracts';
import { toParams } from '@gauzy/common-angular';
import { firstValueFrom, map, shareReplay } from 'rxjs';
import { OrganizationsCacheService } from '../../services/organizations-cache.service';
import { UserOrganizationCacheService } from '../../services/user-organization-cache.service';

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
		findInput?: IUserOrganizationFindInput,
		config?
	): Promise<{ items: IUserOrganization[]; total: number }> {
		const data = JSON.stringify({ relations, findInput });
		let usersOrganizations$ =
			this._userOrganizationsCacheService.getValue('all');
		if (!usersOrganizations$) {
			usersOrganizations$ = this._http
				.get<{
					items: IUserOrganization[];
					total: number;
				}>(`${config.apiHost}/api/user-organization`, {
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

	public async detail(values): Promise<IUserOrganization> {
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
				.get<IUserOrganization>(`${values.apiHost}/api/user/me`, {
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
}
