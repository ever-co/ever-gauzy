import { Injectable } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import {
	IOrganizationTeam,
	IOrganizationTeamFindInput,
	IOrganizationTeamCreateInput,
	IPagination,
	IOrganizationTeamUpdateInput,
	IBasePerTenantAndOrganizationEntityModel
} from '@gauzy/contracts';
import { toParams } from '@gauzy/ui-sdk/common';
import { API_PREFIX } from '@gauzy/ui-sdk/common';

@Injectable({
	providedIn: 'root'
})
export class OrganizationTeamsService {
	constructor(private readonly http: HttpClient) {}

	// TODO: Implement logic to proceed the following requests:
	// 1) Get all employees of selected Organization and put in in the select as options;
	// 2) Create a team with name and members (employees involved);
	// 3) Edit team- similar with create;
	// 4) Delete a team
	// 5) Display all teams: show team name and members - avatar + full name for each member;

	create(body: IOrganizationTeamCreateInput): Promise<IOrganizationTeam> {
		return firstValueFrom(this.http.post<IOrganizationTeam>(`${API_PREFIX}/organization-team`, body));
	}

	getAll(relations: string[] = [], where?: IOrganizationTeamFindInput): Promise<IPagination<IOrganizationTeam>> {
		return firstValueFrom(
			this.http.get<IPagination<IOrganizationTeam>>(`${API_PREFIX}/organization-team`, {
				params: toParams({ where, relations })
			})
		);
	}

	update(id: IOrganizationTeam['id'], body: IOrganizationTeamUpdateInput): Promise<any> {
		return firstValueFrom(this.http.put(`${API_PREFIX}/organization-team/${id}`, body));
	}

	delete(
		id: IOrganizationTeam['id'],
		params: IBasePerTenantAndOrganizationEntityModel
	): Promise<IOrganizationTeam | HttpErrorResponse> {
		return firstValueFrom(
			this.http.delete<IOrganizationTeam>(`${API_PREFIX}/organization-team/${id}`, {
				params: toParams(params)
			})
		);
	}

	getCount(request: IOrganizationTeamFindInput): Promise<number> {
		return firstValueFrom(
			this.http.get<number>(`${API_PREFIX}/organization-team/count`, {
				params: toParams({ ...request })
			})
		);
	}

	getMyTeams(where?: IOrganizationTeamFindInput, relations: string[] = []): Promise<IPagination<IOrganizationTeam>> {
		return firstValueFrom(
			this.http.get<IPagination<IOrganizationTeam>>(`${API_PREFIX}/organization-team/me`, {
				params: toParams({ where, relations })
			})
		);
	}
}
