import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import {
	IEmployee,
	IEmployeeFindInput,
	IEmployeeCreateInput,
	IEmployeeUpdateInput
} from '@gauzy/models';
import { Observable } from 'rxjs';
import { first } from 'rxjs/operators';

@Injectable()
export class EmployeesService {
	constructor(private http: HttpClient) {}

	getAllPublic(
		relations?: string[],
		findInput?: IEmployeeFindInput
	): Observable<{ items: IEmployee[]; total: number }> {
		const data = JSON.stringify({ relations, findInput });

		return this.http.get<{ items: IEmployee[]; total: number }>(
			`/api/employee/public`,
			{
				params: { data }
			}
		);
	}

	getPublicById(id: string, relations?: string[]): Observable<IEmployee> {
		const data = JSON.stringify({ relations });

		return this.http.get<IEmployee>(`/api/employee/public/${id}`, {
			params: { data }
		});
	}

	getAll(
		relations?: string[],
		findInput?: IEmployeeFindInput
	): Observable<{ items: IEmployee[]; total: number }> {
		const data = JSON.stringify({ relations, findInput });

		return this.http.get<{ items: IEmployee[]; total: number }>(
			`/api/employee`,
			{
				params: { data }
			}
		);
	}

	getWorking(
		organizationId: string,
		tenantId: string,
		forMonth: Date,
		withUser: boolean
	): Promise<{ items: IEmployee[]; total: number }> {
		const data = JSON.stringify({
			organizationId,
			tenantId,
			forMonth,
			withUser
		});
		return this.http
			.get<{ items: IEmployee[]; total: number }>(
				`/api/employee/working`,
				{
					params: { data }
				}
			)
			.pipe(first())
			.toPromise();
	}

	getEmployeeByUserId(
		userId: string,
		relations?: string[],
		useTenant?: boolean
	): Promise<{
		success: boolean;
		result: IEmployee;
	}> {
		const data = JSON.stringify({ relations, useTenant });
		return this.http
			.get<{
				success: boolean;
				result: IEmployee;
			}>(`/api/employee/user/${userId}`, {
				params: { data }
			})
			.pipe(first())
			.toPromise();
	}

	getEmployeeById(id: string, relations?: string[], useTenant?: boolean) {
		const data = JSON.stringify({ relations, useTenant });
		return this.http
			.get<IEmployee>(`/api/employee/${id}`, {
				params: { data }
			})
			.pipe(first())
			.toPromise();
	}

	setEmployeeAsInactive(id: string): Promise<IEmployee> {
		return this.http
			.put<IEmployee>(`/api/employee/${id}`, { isActive: false })
			.pipe(first())
			.toPromise();
	}

	setEmployeeEndWork(id: string, date: Date): Promise<IEmployee> {
		return this.http
			.put<IEmployee>(`/api/employee/${id}`, { endWork: date })
			.pipe(first())
			.toPromise();
	}

	update(id: string, updateInput: IEmployeeUpdateInput): Promise<any> {
		return this.http
			.put(`/api/employee/${id}`, updateInput)
			.pipe(first())
			.toPromise();
	}

	create(createInput: IEmployeeCreateInput): Observable<IEmployee> {
		return this.http.post<IEmployee>('/api/employee/create', createInput);
	}

	createBulk(createInput: IEmployeeCreateInput[]): Observable<IEmployee[]> {
		return this.http.post<IEmployee[]>(
			'/api/employee/createBulk',
			createInput
		);
	}
}
