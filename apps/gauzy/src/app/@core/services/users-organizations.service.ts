import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import {
	IUserOrganization,
	IUserOrganizationCreateInput,
	IUserOrganizationFindInput
} from '@gauzy/contracts';
import { Observable } from 'rxjs';
import { first } from 'rxjs/operators';

@Injectable()
export class UsersOrganizationsService {
	constructor(private http: HttpClient) {}

	getAll(
		relations?: string[],
		findInput?: IUserOrganizationFindInput
	): Promise<{ items: IUserOrganization[]; total: number }> {
		const data = JSON.stringify({ relations, findInput });

		return this.http
			.get<{ items: IUserOrganization[]; total: number }>(
				`/api/user-organization`,
				{
					params: { data }
				}
			)
			.pipe(first())
			.toPromise();
	}

	setUserAsInactive(id: string): Promise<IUserOrganization> {
		return this.http
			.put<IUserOrganization>(`/api/user-organization/${id}`, {
				isActive: false
			})
			.pipe(first())
			.toPromise();
	}

	getUserOrganizationCount(id: string): Promise<number> {
		return this.http
			.get<number>(`/api/user-organization/${id}`)
			.pipe(first())
			.toPromise();
	}

	removeUserFromOrg(id: string): Promise<IUserOrganization> {
		return this.http
			.delete<IUserOrganization>(`/api/user-organization/${id}`)
			.pipe(first())
			.toPromise();
	}

	create(
		createInput: IUserOrganizationCreateInput
	): Observable<IUserOrganization> {
		return this.http.post<IUserOrganization>(
			'/api/user-organization',
			createInput
		);
	}
}
