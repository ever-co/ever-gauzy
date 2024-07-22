import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom, Observable } from 'rxjs';
import {
	IEmployee,
	IEmployeeFindInput,
	IEmployeeCreateInput,
	IEmployeeUpdateInput,
	IEmployeeUpdateProfileStatus,
	IBasePerTenantAndOrganizationEntityModel,
	IDateRangePicker,
	IPagination,
	ID
} from '@gauzy/contracts';
import { API_PREFIX, toParams } from '@gauzy/ui-core/common';

@Injectable()
export class EmployeesService {
	constructor(private readonly http: HttpClient) {}

	getAllPublic(request: IEmployeeFindInput, relations: string[] = []): Observable<IPagination<IEmployee>> {
		return this.http.get<IPagination<IEmployee>>(`${API_PREFIX}/public/employee`, {
			params: toParams({ ...request, relations })
		});
	}

	getPublicById(slug: string, id: ID, relations: string[] = []): Observable<IEmployee> {
		return this.http.get<IEmployee>(`${API_PREFIX}/public/employee/${slug}/${id}`, {
			params: toParams({ relations })
		});
	}

	getAll(relations: string[] = [], where?: IEmployeeFindInput): Observable<IPagination<IEmployee>> {
		return this.http.get<IPagination<IEmployee>>(`${API_PREFIX}/employee`, {
			params: toParams({ where, relations })
		});
	}

	getCount(request: IEmployeeFindInput): Observable<number> {
		return this.http.get<number>(`${API_PREFIX}/employee/count`, {
			params: toParams({ ...request })
		});
	}

	getWorking(
		organizationId: string,
		tenantId: string,
		forRange: IDateRangePicker,
		withUser: boolean
	): Promise<IPagination<IEmployee>> {
		const query = {
			organizationId,
			tenantId,
			forRange,
			withUser
		};
		const data = JSON.stringify({ findInput: query });
		return firstValueFrom(
			this.http.get<IPagination<IEmployee>>(`${API_PREFIX}/employee/working`, {
				params: { data }
			})
		);
	}

	getWorkingCount(organizationId: ID, tenantId: ID, forRange: IDateRangePicker): Promise<{ total: number }> {
		const query = {
			organizationId,
			tenantId,
			forRange
		};
		const data = JSON.stringify({ findInput: query });
		return firstValueFrom(
			this.http.get<{ total: number }>(`${API_PREFIX}/employee/working/count`, {
				params: { data }
			})
		);
	}

	/**
	 * Retrieves employee information by ID.
	 *
	 * @param id - The ID of the employee.
	 * @param relations - Optional array of relations to include in the response.
	 * @returns An observable of type `IEmployee` containing the employee's information.
	 */
	getEmployeeById(id: ID, relations: string[] = []) {
		return this.http.get<IEmployee>(`${API_PREFIX}/employee/${id}`, {
			params: toParams({ relations })
		});
	}

	/**
	 * Updates the profile status of an employee.
	 *
	 * @param id - The ID of the employee.
	 * @param status - The new profile status to set for the employee.
	 * @returns A promise that resolves with the updated employee object.
	 */
	setEmployeeProfileStatus(id: ID, status: IEmployeeUpdateProfileStatus): Promise<IEmployee> {
		return firstValueFrom(this.http.put<IEmployee>(`${API_PREFIX}/employee/${id}`, status));
	}

	/**
	 * Sets the end work date for an employee.
	 *
	 * @param id - The ID of the employee.
	 * @param date - The date when the employee's work ended.
	 * @param request - Additional data related to the employee (e.g., tenant and organization).
	 * @returns A promise that resolves with the updated employee object.
	 */
	setEmployeeEndWork(id: ID, date: Date, request: IBasePerTenantAndOrganizationEntityModel): Promise<IEmployee> {
		return firstValueFrom(
			this.http.put<IEmployee>(`${API_PREFIX}/employee/${id}`, {
				endWork: date,
				...request
			})
		);
	}

	/**
	 * Updates the time tracking status for an employee.
	 *
	 * @param id - The ID of the employee.
	 * @param action - Boolean indicating whether to enable or disable time tracking.
	 * @param request - Additional data related to the employee (e.g., tenant and organization).
	 * @returns A promise that resolves with the updated employee object.
	 */
	setEmployeeTimeTrackingStatus(
		id: ID,
		action: boolean,
		request: IBasePerTenantAndOrganizationEntityModel
	): Promise<IEmployee> {
		return firstValueFrom(
			this.http.put<IEmployee>(`${API_PREFIX}/employee/${id}`, {
				isTrackingEnabled: action,
				...request
			})
		);
	}

	/**
	 * Updates an employee's information.
	 *
	 * @param id - The ID of the employee to update.
	 * @param updateInput - The data to update for the employee.
	 * @returns A promise that resolves when the update operation is completed.
	 */
	update(id: ID, updateInput: IEmployeeUpdateInput): Promise<any> {
		return firstValueFrom(this.http.put(`${API_PREFIX}/employee/${id}`, updateInput));
	}

	/**
	 * Permanently delete an employee by ID.
	 *
	 * Sends an HTTP DELETE request to permanently remove the employee record from the database.
	 *
	 * @param id - The ID of the employee to delete.
	 * @param options - Additional context for the operation, including tenant and organization information.
	 * @returns A promise resolving to the result of the DELETE operation or an error message.
	 */
	delete(id: ID, options: IBasePerTenantAndOrganizationEntityModel): Promise<any> {
		return firstValueFrom(
			this.http.delete(`${API_PREFIX}/employee/${id}`, {
				params: toParams({ ...options })
			})
		);
	}

	/**
	 * Soft delete an employee by ID, marking it as deleted without physically removing the record.
	 *
	 * @param id - The ID of the employee to soft delete.
	 * @param options - Additional options for specifying tenant and organization context.
	 * @returns A promise resolving to the deleted employee or a success indicator.
	 */
	softRemove(id: ID, options: IBasePerTenantAndOrganizationEntityModel): Promise<any> {
		return firstValueFrom(
			this.http.delete(`${API_PREFIX}/employee/${id}/soft`, {
				params: toParams({ ...options })
			})
		);
	}

	/**
	 * Restore a soft-deleted employee by ID, effectively undoing the soft delete.
	 *
	 * @param id - The ID of the employee to restore.
	 * @param options - Additional context, typically to specify tenant and organization information.
	 * @returns A promise resolving to the restored employee or a success indicator.
	 */
	softRecover(id: ID, options: IBasePerTenantAndOrganizationEntityModel): Promise<any> {
		return firstValueFrom(this.http.put(`${API_PREFIX}/employee/${id}/recover`, { ...options }));
	}

	/**
	 * Updates the profile of an employee.
	 *
	 * @param id - The ID of the employee.
	 * @param payload - The data to update in the employee's profile.
	 * @returns A promise that resolves with the updated employee profile.
	 */
	updateProfile(id: ID, payload: IEmployeeUpdateInput): Promise<IEmployee> {
		return firstValueFrom(this.http.put<IEmployee>(`${API_PREFIX}/employee/${id}/profile`, payload));
	}

	/**
	 * Creates a new employee with the provided input data.
	 *
	 * @param input - The data to create a new employee.
	 * @returns An observable of the created employee.
	 */
	create(input: IEmployeeCreateInput): Observable<IEmployee> {
		return this.http.post<IEmployee>(`${API_PREFIX}/employee`, input);
	}

	/**
	 * Creates multiple new employees with the provided input data.
	 *
	 * @param createInput - An array of objects, each containing the data to create a new employee.
	 * @returns An observable of an array of created employees.
	 */
	createBulk(input: IEmployeeCreateInput[]): Observable<IEmployee[]> {
		return this.http.post<IEmployee[]>(`${API_PREFIX}/employee/bulk`, input);
	}

	/**
	 * Sets the start work date for an employee.
	 *
	 * @param id - The ID of the employee.
	 * @param date - The date when the employee started work.
	 * @param request - Additional request data that includes tenant and organization details.
	 * @returns A promise of the updated employee.
	 */
	setEmployeeStartWork(id: ID, date: Date, request: IBasePerTenantAndOrganizationEntityModel): Promise<IEmployee> {
		return firstValueFrom(
			this.http.put<IEmployee>(`${API_PREFIX}/employee/${id}`, {
				startedWorkOn: date,
				...request
			})
		);
	}
}
