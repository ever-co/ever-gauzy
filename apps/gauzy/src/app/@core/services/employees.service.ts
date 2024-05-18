import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import {
	IEmployee,
	IEmployeeFindInput,
	IEmployeeCreateInput,
	IEmployeeUpdateInput,
	IEmployeeUpdateProfileStatus,
	IBasePerTenantAndOrganizationEntityModel,
	IDateRangePicker,
	IPagination,
	UpdateEmployeeJobsStatistics
} from '@gauzy/contracts';
import { firstValueFrom, Observable } from 'rxjs';
import { toParams } from '@gauzy/ui-sdk/common';
import { API_PREFIX } from '@gauzy/ui-sdk/common';

@Injectable()
export class EmployeesService {
	constructor(private readonly http: HttpClient) {}

	getAllPublic(request: IEmployeeFindInput, relations: string[] = []): Observable<IPagination<IEmployee>> {
		return this.http.get<IPagination<IEmployee>>(`${API_PREFIX}/public/employee`, {
			params: toParams({ ...request, relations })
		});
	}

	getPublicById(slug: string, id: string, relations: string[] = []): Observable<IEmployee> {
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

	getWorkingCount(organizationId: string, tenantId: string, forRange: IDateRangePicker): Promise<{ total: number }> {
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

	getEmployeeById(id: string, relations: string[] = []) {
		return this.http.get<IEmployee>(`${API_PREFIX}/employee/${id}`, {
			params: toParams({ relations })
		});
	}

	setEmployeeProfileStatus(id: string, status: IEmployeeUpdateProfileStatus): Promise<IEmployee> {
		return firstValueFrom(this.http.put<IEmployee>(`${API_PREFIX}/employee/${id}`, status));
	}

	setEmployeeEndWork(id: string, date: Date, request: IBasePerTenantAndOrganizationEntityModel): Promise<IEmployee> {
		return firstValueFrom(
			this.http.put<IEmployee>(`${API_PREFIX}/employee/${id}`, {
				endWork: date,
				...request
			})
		);
	}

	setEmployeeTimeTrackingStatus(
		id: string,
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

	update(id: string, updateInput: IEmployeeUpdateInput): Promise<any> {
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
	delete(id: string, options: IBasePerTenantAndOrganizationEntityModel): Promise<any> {
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
	softRemove(id: string, options: IBasePerTenantAndOrganizationEntityModel): Promise<any> {
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
	softRecover(id: string, options: IBasePerTenantAndOrganizationEntityModel): Promise<any> {
		return firstValueFrom(this.http.put(`${API_PREFIX}/employee/${id}/recover`, { ...options }));
	}

	/**
	 *
	 * @param id
	 * @param payload
	 * @returns
	 */
	updateProfile(id: string, payload: IEmployeeUpdateInput): Promise<IEmployee> {
		return firstValueFrom(this.http.put<IEmployee>(`${API_PREFIX}/employee/${id}/profile`, payload));
	}

	/**
	 *
	 * @param request
	 * @returns
	 */
	getEmployeeJobsStatistics(request): Promise<any> {
		return firstValueFrom(
			this.http.get(`${API_PREFIX}/employee/job-statistics`, {
				params: toParams(request)
			})
		);
	}

	/**
	 *
	 * @param id
	 * @param statistics
	 * @returns
	 */
	updateJobSearchStatus(id: IEmployee['id'], statistics: UpdateEmployeeJobsStatistics) {
		return firstValueFrom(this.http.put(`${API_PREFIX}/employee/${id}/job-search-status`, statistics));
	}

	create(body: IEmployeeCreateInput): Observable<IEmployee> {
		return this.http.post<IEmployee>(`${API_PREFIX}/employee`, body);
	}

	createBulk(createInput: IEmployeeCreateInput[]): Observable<IEmployee[]> {
		return this.http.post<IEmployee[]>(`${API_PREFIX}/employee/bulk`, createInput);
	}

	setEmployeeStartWork(
		id: string,
		date: Date,
		request: IBasePerTenantAndOrganizationEntityModel
	): Promise<IEmployee> {
		return firstValueFrom(
			this.http.put<IEmployee>(`${API_PREFIX}/employee/${id}`, {
				startedWorkOn: date,
				...request
			})
		);
	}
}
