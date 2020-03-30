import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import {
	UserOrganization,
	UserOrganizationCreateInput,
	UserOrganizationFindInput
} from '@gauzy/models';
import { Observable } from 'rxjs';
import { first } from 'rxjs/operators';

@Injectable()
export class UsersOrganizationsService {
	constructor(private http: HttpClient) {}

	getAll(
		relations?: string[],
		findInput?: UserOrganizationFindInput
	): Promise<{ items: UserOrganization[]; total: number }> {
		const data = JSON.stringify({ relations, findInput });

		return this.http
			.get<{ items: UserOrganization[]; total: number }>(
				`/api/user-organization`,
				{
					params: { data }
				}
			)
			.pipe(first())
			.toPromise();
	}

	setUserAsInactive(id: string): Promise<UserOrganization> {
		return this.http
			.put<UserOrganization>(`/api/user-organization/${id}`, {
				isActive: false
			})
			.pipe(first())
			.toPromise();
	}

	removeUserFromOrg(id: string): Promise<UserOrganization> {
		return this.http
			.delete<UserOrganization>(`/api/user-organization/${id}`)
			.pipe(first())
			.toPromise();
	}

	create(
		createInput: UserOrganizationCreateInput
	): Observable<UserOrganization> {
		return this.http.post<UserOrganization>(
			'/api/user-organization',
			createInput
		);
	}

	// This was not being used and it overrides the default unnecessarily, so removed:
	// findOne(
	// 	findInput?: UserOrganizationFindInput
	// ): Observable<UserOrganization> {
	// 	const findInputStr = JSON.stringify(findInput);
	// 	return this.http.get<UserOrganization>(`/api/user-organization`, {
	// 		params: { findInputStr }
	// 	});
	// }
}
