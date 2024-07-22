import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { firstValueFrom, Observable } from 'rxjs';
import {
	ID,
	IPagination,
	IUserOrganization,
	IUserOrganizationCreateInput,
	IUserOrganizationFindInput
} from '@gauzy/contracts';
import { API_PREFIX, toParams } from '@gauzy/ui-core/common';

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

	/**
	 * Set user as inactive in the organization.
	 *
	 * @param id - The ID of the user organization.
	 * @returns A promise that resolves to the updated user organization.
	 */
	setUserAsInactive(id: ID): Promise<IUserOrganization> {
		return firstValueFrom(
			this.http.put<IUserOrganization>(`${API_PREFIX}/user-organization/${id}`, {
				isActive: false
			})
		);
	}

	/**
	 * Get the count of organizations a user belongs to.
	 *
	 * @param id - The user ID.
	 * @returns A promise that resolves to the count of organizations.
	 */
	getUserOrganizationCount(id: ID): Promise<number> {
		return firstValueFrom(this.http.get<number>(`${API_PREFIX}/user-organization/${id}/count`));
	}

	/**
	 * Remove user from the organization.
	 *
	 * @param id - The ID of the user organization.
	 * @returns A promise that resolves to the removed user organization.
	 */
	removeUserFromOrg(id: ID): Promise<IUserOrganization> {
		return firstValueFrom(this.http.delete<IUserOrganization>(`${API_PREFIX}/user-organization/${id}`));
	}

	/**
	 * Create a new user organization.
	 *
	 * @param input - The input data for creating a user organization.
	 * @returns An observable that resolves to the created user organization.
	 */
	create(input: IUserOrganizationCreateInput): Observable<IUserOrganization> {
		return this.http.post<IUserOrganization>(`${API_PREFIX}/user-organization`, input);
	}
}
