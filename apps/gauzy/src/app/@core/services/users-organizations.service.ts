import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { firstValueFrom, Observable } from 'rxjs';
import {
	IPagination,
	IUserOrganization,
	IUserOrganizationCreateInput,
	IUserOrganizationFindInput
} from '@gauzy/contracts';
import { toParams } from '@gauzy/ui-sdk/common';
import { API_PREFIX } from '@gauzy/ui-sdk/common';

@Injectable()
export class UsersOrganizationsService {
	constructor(private readonly http: HttpClient) {}

	/**
	 * Retrieves user organizations based on specified relations, conditions, and employee inclusion.
	 *
	 * @param relations An array of relation names to be eager loaded.
	 * @param where Optional conditions to filter user organizations.
	 * @param includeEmployee Specifies whether to include employee information.
	 * @returns A promise that resolves to a paginated result of user organizations.
	 */
	getAll(
		relations: string[] = [],
		where?: IUserOrganizationFindInput,
		includeEmployee: boolean = false
	): Promise<IPagination<IUserOrganization>> {
		// Construct request parameters
		const params: any = { relations, where, includeEmployee };

		// Send HTTP GET request to retrieve user organizations
		return firstValueFrom(
			this.http.get<IPagination<IUserOrganization>>(`${API_PREFIX}/user-organization`, {
				params: toParams(params)
			})
		);
	}

	setUserAsInactive(id: string): Promise<IUserOrganization> {
		return firstValueFrom(
			this.http.put<IUserOrganization>(`${API_PREFIX}/user-organization/${id}`, {
				isActive: false
			})
		);
	}

	getUserOrganizationCount(id: string): Promise<number> {
		return firstValueFrom(this.http.get<number>(`${API_PREFIX}/user-organization/${id}`));
	}

	removeUserFromOrg(id: string): Promise<IUserOrganization> {
		return firstValueFrom(this.http.delete<IUserOrganization>(`${API_PREFIX}/user-organization/${id}`));
	}

	create(createInput: IUserOrganizationCreateInput): Observable<IUserOrganization> {
		return this.http.post<IUserOrganization>(`${API_PREFIX}/user-organization`, createInput);
	}
}
