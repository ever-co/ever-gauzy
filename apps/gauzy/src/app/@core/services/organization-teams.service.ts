import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import {
	IOrganizationTeam,
	IOrganizationTeamFindInput,
	IOrganizationTeamCreateInput,
	IPagination,
	IOrganizationTeamUpdateInput
} from '@gauzy/contracts';
import { toParams } from '@gauzy/common-angular';
import { API_PREFIX } from '../constants/app.constants';

@Injectable({
	providedIn: 'root'
})
export class OrganizationTeamsService {

	constructor(
		private readonly http: HttpClient
	) {}

	// TODO: Implement logic to proceed the following requests:
	// 1) Get all employees of selected Organization and put in in the select as options;
	// 2) Create a team with name and members (employees involved);
	// 3) Edit team- simillar with create;
	// 4) Delete a team
	// 5) Display all teams: show team name and members - avatar + full name for each member;

	create(body: IOrganizationTeamCreateInput): Promise<IOrganizationTeam> {
		return firstValueFrom(
			this.http.post<IOrganizationTeam>(`${API_PREFIX}/organization-team`, body)
		);
	}

	getAll(
		relations: string[] = [],
		where?: IOrganizationTeamFindInput
	): Promise<IPagination<IOrganizationTeam>> {
		return firstValueFrom(
			this.http.get<IPagination<IOrganizationTeam>>(`${API_PREFIX}/organization-team`, {
				params: toParams({ where, relations })
			})
		);
	}

	update(
		id: IOrganizationTeam['id'],
		body: IOrganizationTeamUpdateInput
	): Promise<any> {
		return firstValueFrom(
			this.http.put(`${API_PREFIX}/organization-team/${id}`, body)
		);
	}

	delete(id: IOrganizationTeam['id']): Promise<any> {
		return firstValueFrom(
			this.http.delete(`${API_PREFIX}/organization-team/${id}`)
		);
	}

	getMyTeams(
		relations: string[] = [],
		where?: IOrganizationTeamFindInput
	): Promise<IPagination<IOrganizationTeam>> {
		return firstValueFrom(
			this.http.get<IPagination<IOrganizationTeam>>(`${API_PREFIX}/organization-team/me`, {
				params: toParams({ where, relations })
			})
		);
	}
}
