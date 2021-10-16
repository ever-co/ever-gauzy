import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import {
	IUserOrganization,
	IUserOrganizationCreateInput,
	IUserOrganizationFindInput
} from '@gauzy/contracts';
import { firstValueFrom, Observable } from 'rxjs';
import { first } from 'rxjs/operators';
import { API_PREFIX } from '../constants/app.constants';

@Injectable()
export class UsersOrganizationsService {
	constructor(private http: HttpClient) {}

	getAll(
		relations?: string[],
		findInput?: IUserOrganizationFindInput
	): Promise<{ items: IUserOrganization[]; total: number }> {
		const data = JSON.stringify({ relations, findInput });
		return firstValueFrom(
			this.http
			.get<{ items: IUserOrganization[]; total: number }>(
				`${API_PREFIX}/user-organization`,
				{
					params: { data }
				}
			)
		);
	}

	setUserAsInactive(id: string): Promise<IUserOrganization> {
		return this.http
			.put<IUserOrganization>(`${API_PREFIX}/user-organization/${id}`, {
				isActive: false
			})
			.pipe(first())
			.toPromise();
	}

	getUserOrganizationCount(id: string): Promise<number> {
		return this.http
			.get<number>(`${API_PREFIX}/user-organization/${id}`)
			.pipe(first())
			.toPromise();
	}

	removeUserFromOrg(id: string): Promise<IUserOrganization> {
		return this.http
			.delete<IUserOrganization>(`${API_PREFIX}/user-organization/${id}`)
			.pipe(first())
			.toPromise();
	}

	create(
		createInput: IUserOrganizationCreateInput
	): Observable<IUserOrganization> {
		return this.http.post<IUserOrganization>(
			`${API_PREFIX}/user-organization`,
			createInput
		);
	}
}
