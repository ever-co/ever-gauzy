import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import {
	OrganizationTeams,
	OrganizationTeamFindInput,
	OrganizationTeamCreateInput
} from '@gauzy/models';
import { first } from 'rxjs/operators';

@Injectable({
	providedIn: 'root'
})
export class OrganizationTeamsService {
	constructor(private http: HttpClient) {}

	// TODO: Implement logic to proceed the fowolling requests:
	// 1) Get all employees of selected Organization and put in in the select as options;
	// 2) Create a team with name and members (employees involved);
	// 3) Edit team- simillar with create;
	// 4) Delete a team
	// 5) Display all teams: show team name and members - avatar + full name for each member;

	create(
		createInput: OrganizationTeamCreateInput
	): Promise<OrganizationTeams> {
		return this.http
			.post<OrganizationTeams>(
				'/api/organization-teams/create',
				createInput
			)
			.pipe(first())
			.toPromise();
	}

	getAll(
		relations?: string[],
		findInput?: OrganizationTeamFindInput
	): Promise<{ items: any[]; total: number }> {
		const data = JSON.stringify({ relations, findInput });

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
