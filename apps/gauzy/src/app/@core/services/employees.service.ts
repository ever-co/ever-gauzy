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
import { toParams } from '@gauzy/common-angular';
import { API_PREFIX } from '../constants/app.constants';

@Injectable()
export class EmployeesService {
	constructor(
		private readonly http: HttpClient
	) {}

	getAllPublic(
		request: IEmployeeFindInput,
		relations: string[] = []
	): Observable<IPagination<IEmployee>> {
		return this.http.get<IPagination<IEmployee>>(`${API_PREFIX}/public/employee`, {
			params: toParams({ ...request, relations })
		})
	}

	getPublicById(
		slug: string,
		id: string,
		relations: string[] = []
	): Observable<IEmployee> {
		return this.http.get<IEmployee>(`${API_PREFIX}/public/employee/${slug}/${id}`, {
			params: toParams({ relations })
		});
	}

	getAll(
		relations: string[] = [],
		where?: IEmployeeFindInput
	): Observable<{ items: IEmployee[]; total: number }> {
		return this.http.get<{ items: IEmployee[]; total: number }>( `${API_PREFIX}/employee`, {
			params: toParams({ where, relations })
		});
	}

	getCount(
		request: IEmployeeFindInput
	): Promise<any> {
		return firstValueFrom(
			this.http.get<{ items: IEmployeeFindInput[]; total: number }>(`${API_PREFIX}/employee/count`, {
				params: toParams({ ...request })
			})
		);
	}

	getWorking(
		organizationId: string,
		tenantId: string,
		forRange: IDateRangePicker,
		withUser: boolean
	): Promise<{ items: IEmployee[]; total: number }> {
		const query = {
			organizationId,
			tenantId,
			forRange,
			withUser
		};
		const data = JSON.stringify({ findInput: query });
		return firstValueFrom(
			this.http.get<{ items: IEmployee[]; total: number }>(
				`${API_PREFIX}/employee/working`,
				{
					params: { data }
				}
			)
		);
	}

	getWorkingCount(
		organizationId: string,
		tenantId: string,
		forRange: IDateRangePicker,
		withUser: boolean
	): Promise<{ total: number }> {
		const query = {
			organizationId,
			tenantId,
			forRange,
			withUser
		};
		const data = JSON.stringify({ findInput: query });
		return firstValueFrom(
			this.http.get<{ items: IEmployee[]; total: number }>( `${API_PREFIX}/employee/working/count`, {
				params: { data}
			})
		);
	}

	getEmployeeById(
		id: string,
		relations: string[] = []
	) {
		return this.http.get<IEmployee>(`${API_PREFIX}/employee/${id}`, {
			params: toParams({ relations })
		});
	}

	setEmployeeProfileStatus(id: string, status: IEmployeeUpdateProfileStatus): Promise<IEmployee> {
		return firstValueFrom(
			this.http.put<IEmployee>(`${API_PREFIX}/employee/${id}`, status)
		);
	}

	setEmployeeEndWork(id: string, date: Date, request: IBasePerTenantAndOrganizationEntityModel): Promise<IEmployee> {
		return firstValueFrom(
			this.http.put<IEmployee>(`${API_PREFIX}/employee/${id}`, {
				endWork: date,
				...request
			})
		);
	}

	setEmployeeTimeTrackingStatus(id: string, action: boolean, request: IBasePerTenantAndOrganizationEntityModel): Promise<IEmployee> {
		return firstValueFrom(
			this.http.put<IEmployee>(`${API_PREFIX}/employee/${id}`, {
				isTrackingEnabled: action,
				...request
			})
		);
	}

	update(id: string, updateInput: IEmployeeUpdateInput): Promise<any> {
		return firstValueFrom(
			this.http.put(`${API_PREFIX}/employee/${id}`, updateInput)
		);
	}

	updateProfile(id: string, payload: IEmployeeUpdateInput): Promise<IEmployee> {
		return firstValueFrom(
			this.http.put<IEmployee>(`${API_PREFIX}/employee/${id}/profile`, payload)
		);
	}

	getEmployeeJobsStatistics(request): Promise<any> {
		return firstValueFrom(
			this.http.get(`${API_PREFIX}/employee/job-statistics`, {
				params: toParams(request)
			})
		);
	}

	updateJobSearchStatus(
		id: IEmployee['id'],
		statistics: UpdateEmployeeJobsStatistics
	) {
		return firstValueFrom(
			this.http.put(`${API_PREFIX}/employee/${id}/job-search-status`, statistics)
		);
	}

	create(createInput: IEmployeeCreateInput): Observable<IEmployee> {
		return this.http.post<IEmployee>(
			`${API_PREFIX}/employee`,
			createInput
		);
	}

	createBulk(createInput: IEmployeeCreateInput[]): Observable<IEmployee[]> {
		return this.http.post<IEmployee[]>(
			`${API_PREFIX}/employee/bulk`,
			createInput
		);
	}
}
