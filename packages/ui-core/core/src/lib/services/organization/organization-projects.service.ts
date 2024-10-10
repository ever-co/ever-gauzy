import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, firstValueFrom, take } from 'rxjs';
import {
	IOrganizationProjectCreateInput,
	IOrganizationProject,
	IOrganizationProjectsFindInput,
	IPagination,
	IOrganizationProjectUpdateInput,
	IOrganizationProjectSetting,
	ID,
	IOrganizationProjectEditByEmployeeInput
} from '@gauzy/contracts';
import { toParams } from '@gauzy/ui-core/common';
import { API_PREFIX } from '@gauzy/ui-core/common';

@Injectable({
	providedIn: 'root'
})
export class OrganizationProjectsService {
	private readonly API_URL = `${API_PREFIX}/organization-projects`;

	constructor(private readonly _http: HttpClient) {}

	/**
	 * Creates a new organization project.
	 *
	 * @param input The input data for creating the project.
	 * @returns A Promise that resolves with the newly created project.
	 */
	create(input: IOrganizationProjectCreateInput): Promise<IOrganizationProject> {
		return firstValueFrom(this._http.post<IOrganizationProject>(this.API_URL, input));
	}

	/**
	 * Edits an existing organization project.
	 *
	 * @param input The input data for updating the project. Partial data is accepted.
	 * @returns A Promise that resolves with the updated project.
	 */
	edit(input: Partial<IOrganizationProjectUpdateInput>): Promise<IOrganizationProject> {
		return firstValueFrom(this._http.put<IOrganizationProject>(`${this.API_URL}/${input.id}`, input));
	}

	/**
	 * Retrieves all projects assigned to a specific employee.
	 *
	 * @param id The employee ID.
	 * @param where Optional filters to apply when retrieving projects.
	 * @returns A Promise that resolves with a list of organization projects assigned to the employee.
	 */
	getAllByEmployee(id: ID, where?: IOrganizationProjectsFindInput): Promise<IOrganizationProject[]> {
		return firstValueFrom(
			this._http.get<IOrganizationProject[]>(`${this.API_URL}/employee/${id}`, {
				params: toParams({ ...where })
			})
		);
	}

	/**
	 * Retrieves all organization projects, with optional relations and filters.
	 *
	 * @param relations Optional array of related entities to include.
	 * @param where Optional filters to apply when retrieving projects.
	 * @returns A Promise that resolves with paginated organization projects.
	 */
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

	/**
	 * Retrieves a specific organization project by its ID.
	 *
	 * @param id The ID of the project.
	 * @param relations Optional array of related entities to include.
	 * @returns An Observable that resolves with the requested project.
	 */
	getById(id: ID, relations: string[] = []): Observable<IOrganizationProject> {
		return this._http.get<IOrganizationProject>(`${this.API_URL}/${id}`, {
			params: toParams({ relations })
		});
	}

	/**
	 * Retrieves the total count of organization projects that match the given criteria.
	 *
	 * @param request The input criteria for finding the projects.
	 * @returns A Promise that resolves with the count of matching projects.
	 */
	getCount(request: IOrganizationProjectsFindInput): Promise<number> {
		return firstValueFrom(
			this._http.get<number>(`${this.API_URL}/count`, {
				params: toParams({ ...request })
			})
		);
	}

	/**
	 * Updates project assignments for an employee.
	 *
	 * @param updateInput The input data containing employee and project information.
	 * @returns A Promise that resolves once the update operation is complete.
	 */
	updateByEmployee(updateInput: IOrganizationProjectEditByEmployeeInput): Promise<any> {
		return firstValueFrom(this._http.put(`${this.API_URL}/employee`, updateInput));
	}

	/**
	 * Updates the task view mode for a specific project.
	 *
	 * @param id The ID of the project.
	 * @param input The input data for updating the task view mode.
	 * @returns A Promise that resolves with the updated project.
	 */
	updateTaskViewMode(id: ID, input: IOrganizationProjectUpdateInput): Promise<IOrganizationProject> {
		return firstValueFrom(
			this._http.put<IOrganizationProject>(`${this.API_URL}/task-view/${id}`, input).pipe(take(1))
		);
	}

	/**
	 * Deletes an organization project by its ID.
	 *
	 * @param id The ID of the project to delete.
	 * @returns A Promise that resolves once the project is deleted.
	 */
	delete(id: ID): Promise<any> {
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
	updateProjectSetting(id: ID, input: IOrganizationProjectSetting): Observable<IOrganizationProjectSetting> {
		// Construct the URL for the API endpoint
		const url = `${this.API_URL}/setting/${id}`;

		// Send an HTTP Put request to the specified URL with input parameters
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
