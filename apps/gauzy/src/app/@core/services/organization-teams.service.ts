import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import {
	OrganizationTeams,
	OrganizationTeamsFindInput,
	OrganizationTeamsCreateInput
} from '@gauzy/models';
import { first } from 'rxjs/operators';

@Injectable({
	providedIn: 'root'
})
export class OrganizationTeamsService {
	constructor(private http: HttpClient) {}

	create(
		createInput: OrganizationTeamsCreateInput
	): Promise<OrganizationTeams> {
		return this.http
			.post<OrganizationTeams>('/api/organization-teams', createInput)
			.pipe(first())
			.toPromise();
	}

	getAll(
		findInput?: OrganizationTeamsFindInput
	): Promise<{ items: any[]; total: number }> {
		const data = JSON.stringify({ findInput });

		return this.http
			.get<{ items: OrganizationTeams[]; total: number }>(
				`/api/organization-teams`,
				{
					params: { data }
				}
			)
			.pipe(first())
			.toPromise();
	}

	update(id: string, updateInput: any): Promise<any> {
		return this.http
			.put(`/api/organization-teams/${id}`, updateInput)
			.pipe(first())
			.toPromise();
	}

	delete(id: string): Promise<any> {
		return this.http
			.delete(`/api/organization-teams/${id}`)
			.pipe(first())
			.toPromise();
	}
}
