import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, firstValueFrom, take } from 'rxjs';
import {
	IOrganizationProjectCreateInput,
	IOrganizationProject,
	IOrganizationProjectsFindInput,
	IEditEntityByMemberInput,
	IPagination,
	IEmployee,
	IOrganizationProjectUpdateInput,
	IOrganizationProjectSetting
} from '@gauzy/contracts';
import { toParams } from '@gauzy/ui-sdk/common';
import { API_PREFIX } from '@gauzy/ui-sdk/common';

@Injectable({
	providedIn: 'root'
})
export class OrganizationProjectsService {
	private readonly API_URL = `${API_PREFIX}/organization-projects`;

	constructor(private readonly _http: HttpClient) {}

	create(body: IOrganizationProjectCreateInput): Promise<IOrganizationProject> {
		return firstValueFrom(this._http.post<IOrganizationProject>(this.API_URL, body));
	}

	edit(body: Partial<IOrganizationProjectUpdateInput>): Promise<IOrganizationProject> {
		return firstValueFrom(this._http.put<IOrganizationProject>(`${this.API_URL}/${body.id}`, body));
	}

	getAllByEmployee(id: IEmployee['id'], where?: IOrganizationProjectsFindInput): Promise<IOrganizationProject[]> {
		return firstValueFrom(
			this._http.get<IOrganizationProject[]>(`${this.API_URL}/employee/${id}`, {
				params: toParams({ ...where })
			})
		);
	}

	getAll(
		relations: string[] = [],
		where?: IOrganizationProjectsFindInput
	): Promise<IPagination<IOrganizationProject>> {
		return firstValueFrom(
			this._http.get<IPagination<IOrganizationProject>>(`${this.API_URL}`, {
				params: toParams({ where, relations })
			})
		);
	}

	getById(id: IOrganizationProject['id'], relations: string[] = []): Observable<IOrganizationProject> {
		return this._http.get<IOrganizationProject>(`${this.API_URL}/${id}`, {
			params: toParams({ relations })
		});
	}

	getCount(request: IOrganizationProjectsFindInput): Promise<number> {
		return firstValueFrom(
			this._http.get<number>(`${this.API_URL}/count`, {
				params: toParams({ ...request })
			})
		);
	}

	updateByEmployee(updateInput: IEditEntityByMemberInput): Promise<any> {
		return firstValueFrom(this._http.put(`${this.API_URL}/employee`, updateInput));
	}

	updateTaskViewMode(
		id: IOrganizationProject['id'],
		body: IOrganizationProjectUpdateInput
	): Promise<IOrganizationProject> {
		return firstValueFrom(
			this._http.put<IOrganizationProject>(`${this.API_URL}/task-view/${id}`, body).pipe(take(1))
		);
	}

	delete(id: IOrganizationProject['id']): Promise<any> {
		return firstValueFrom(this._http.delete(`${this.API_URL}/${id}`));
	}

	/**
	 * Updates the settings for an organization project.
	 *
	 * @param id - The unique identifier (ID) of the organization project to update.
	 * @param input - The updated project settings to apply.
	 *
	 * @returns An Observable of type `IOrganizationProject` representing the updated organization project.
	 */
	updateProjectSetting(
		id: IOrganizationProject['id'],
		input: IOrganizationProjectSetting
	): Observable<IOrganizationProjectSetting> {
		const url = `${this.API_URL}/setting/${id}`;
		return this._http.put<IOrganizationProject>(url, input);
	}

	/**
	 * Retrieve a list of synchronized organization projects with Github Repositories.
	 *
	 * @param where - Criteria for filtering projects.
	 * @param relations - An array of related entities to include in the response (optional).
	 * @returns An observable containing the paginated list of synchronized organization projects.
	 */
	findSyncedProjects(
		where: IOrganizationProjectsFindInput,
		relations: string[] = []
	): Observable<IPagination<IOrganizationProject>> {
		// Construct the URL for the API endpoint
		const url = `${this.API_URL}/synced`;

		// Send an HTTP GET request to the specified URL with query parameters
		return this._http.get<IPagination<IOrganizationProject>>(url, {
			params: toParams({ where, relations })
		});
	}
}
