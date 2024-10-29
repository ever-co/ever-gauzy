import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import {
	IOrganizationProjectModule,
	IPagination,
	ID,
	IOrganizationProjectModuleCreateInput,
	IOrganizationProjectModuleUpdateInput
} from '@gauzy/contracts';
import { API_PREFIX } from '@gauzy/ui-core/common';

@Injectable({
	providedIn: 'root'
})
export class OrganizationProjectModuleService {
	private readonly API_URL = `${API_PREFIX}/organization-project-module`;

	constructor(private readonly http: HttpClient) {}

	/**
	 * Create a new project module with the provided data.
	 * @param {IOrganizationProjectModuleCreateInput} data - The data for creating the new project module.
	 * @returns An Observable that emits the newly created project module.
	 */
	create(data: IOrganizationProjectModuleCreateInput): Observable<IOrganizationProjectModule> {
		return this.http.post<IOrganizationProjectModule>(this.API_URL, data);
	}

	/**
	 * Update an existing project module identified by its ID with the new data.
	 * @param {ID} id - The unique identifier of the project module to update.
	 * @param {IOrganizationProjectModuleUpdateInput} data - The new data for updating the project module.
	 * @returns An Observable that emits the updated project module or result.
	 */
	update(id: ID, data: IOrganizationProjectModuleUpdateInput): Observable<IOrganizationProjectModule> {
		return this.http.put<IOrganizationProjectModule>(`${this.API_URL}/${id}`, data);
	}

	/**
	 * Find project modules for an employee based on pagination parameters.
	 * @param params - The pagination parameters for filtering employee project modules.
	 * @returns An Observable that emits the paginated list of employee project modules.
	 */
	getEmployeeProjectModules(params: HttpParams): Observable<IPagination<IOrganizationProjectModule>> {
		return this.http.get<IPagination<IOrganizationProjectModule>>(`${this.API_URL}/employee`, { params });
	}

	/**
	 * Retrieve project modules associated with a team using pagination parameters.
	 * @param params - The pagination parameters for filtering team project modules.
	 * @returns An Observable that emits the paginated list of team project modules.
	 */
	findTeamProjectModules(params: HttpParams): Observable<IPagination<IOrganizationProjectModule>> {
		return this.http.get<IPagination<IOrganizationProjectModule>>(`${this.API_URL}/team`, { params });
	}

	/**
	 * Retrieve project modules associated with a specific employee.
	 * @param employeeId - The unique identifier of the employee.
	 * @param params - Additional query parameters for filtering.
	 * @returns An Observable that emits the paginated list of project modules for the specified employee.
	 */
	findByEmployee(employeeId: ID, params: HttpParams): Observable<IPagination<IOrganizationProjectModule>> {
		return this.http.get<IPagination<IOrganizationProjectModule>>(`${this.API_URL}/employee/${employeeId}`, {
			params
		});
	}

	/**
	 * Retrieve all project modules with pagination parameters.
	 * @param params - The pagination parameters for filtering all project modules.
	 * @returns An Observable that emits the paginated list of project modules.
	 */
	findAll(params: HttpParams): Observable<IPagination<IOrganizationProjectModule>> {
		return this.http.get<IPagination<IOrganizationProjectModule>>(this.API_URL, { params });
	}

	/**
	 * Find a specific project module by its unique identifier.
	 * @param id - The unique identifier of the project module.
	 * @param params - Additional query parameters if required.
	 * @returns An Observable that emits the found project module.
	 */
	findById(id: ID, params: HttpParams): Observable<IOrganizationProjectModule> {
		return this.http.get<IOrganizationProjectModule>(`${this.API_URL}/${id}`, { params });
	}

	/**
	 * Delete an existing project module by its unique identifier.
	 * @param id - The unique identifier of the project module to delete.
	 * @returns An Observable that emits the result of the delete operation.
	 */
	delete(id: ID): Observable<void> {
		return this.http.delete<void>(`${this.API_URL}/${id}`);
	}
}
