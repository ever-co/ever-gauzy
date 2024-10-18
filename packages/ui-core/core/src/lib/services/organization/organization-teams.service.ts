import { Injectable } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { catchError, firstValueFrom, of } from 'rxjs';
import {
	IOrganizationTeam,
	IOrganizationTeamFindInput,
	IOrganizationTeamCreateInput,
	IPagination,
	IOrganizationTeamUpdateInput,
	IBasePerTenantAndOrganizationEntityModel,
	ID
} from '@gauzy/contracts';
import { API_PREFIX, toParams } from '@gauzy/ui-core/common';

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

	/**
	 * Creates a new organization team.
	 *
	 * @param input - The input data for creating the team.
	 * @returns A promise that resolves to the created organization team.
	 */
	create(input: IOrganizationTeamCreateInput): Promise<IOrganizationTeam> {
		return firstValueFrom(this.http.post<IOrganizationTeam>(`${API_PREFIX}/organization-team`, input));
	}

	/**
	 * Retrieves all organization teams, optionally filtered and related.
	 *
	 * @param relations - An array of relations to include in the response.
	 * @param where - Optional filter criteria for retrieving teams.
	 * @returns A promise that resolves to a paginated list of organization teams.
	 */
	getAll(relations: string[] = [], where?: IOrganizationTeamFindInput): Promise<IPagination<IOrganizationTeam>> {
		return firstValueFrom(
			this.http.get<IPagination<IOrganizationTeam>>(`${API_PREFIX}/organization-team`, {
				params: toParams({ where, relations })
			})
		);
	}

	/**
	 * Updates an existing organization team.
	 *
	 * @param id - The ID of the team to update.
	 * @param input - The input data for updating the team.
	 * @returns A promise that resolves to the updated organization team or a response.
	 */
	update(id: ID, input: IOrganizationTeamUpdateInput): Promise<any> {
		return firstValueFrom(this.http.put(`${API_PREFIX}/organization-team/${id}`, input));
	}

	/**
	 * Deletes an organization team by ID.
	 *
	 * @param id - The ID of the team to delete.
	 * @param params - Additional parameters for the delete request.
	 * @returns A promise that resolves to the deleted organization team or an error response.
	 */
	delete(id: ID, params: IBasePerTenantAndOrganizationEntityModel): Promise<IOrganizationTeam | HttpErrorResponse> {
		return firstValueFrom(
			this.http.delete<IOrganizationTeam>(`${API_PREFIX}/organization-team/${id}`, {
				params: toParams(params)
			})
		);
	}

	/**
	 * Gets the count of organization teams based on the provided filter.
	 *
	 * @param params - The filter criteria for counting teams.
	 * @returns A promise that resolves to the number of organization teams.
	 */
	getCount(params: IOrganizationTeamFindInput): Promise<number> {
		return firstValueFrom(
			this.http.get<number>(`${API_PREFIX}/organization-team/count`, {
				params: toParams({ ...params })
			})
		);
	}

	/**
	 * Fetches the teams associated with the authenticated user.
	 *
	 * @param where - Optional filter criteria for fetching teams.
	 * @param relations - Optional list of relations to include in the response.
	 * @returns A promise that resolves to a paginated list of organization teams.
	 */
	getMyTeams(where?: IOrganizationTeamFindInput, relations: string[] = []): Promise<IPagination<IOrganizationTeam>> {
		return firstValueFrom(
			this.http
				.get<IPagination<IOrganizationTeam>>(`${API_PREFIX}/organization-team/me`, {
					params: toParams({ where, relations })
				})
				.pipe(
					catchError((error) => {
						console.log('Error fetching teams:', error);
						return of({ total: 0, items: [] });
					})
				)
		);
	}
}
