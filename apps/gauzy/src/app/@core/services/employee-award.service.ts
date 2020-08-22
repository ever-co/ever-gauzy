import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import {
	IEmployeeAward,
	IEmployeeAwardFindInput,
	IEmployeeAwardCreateInput
} from '@gauzy/models';
import { Observable } from 'rxjs';

@Injectable({
	providedIn: 'root'
})
export class EmployeeAwardService {
	constructor(private http: HttpClient) {}

	create(createInput: IEmployeeAwardCreateInput): Observable<IEmployeeAward> {
		return this.http.post<IEmployeeAward>(
			'/api/employee-award',
			createInput
		);
	}

	getAll(
		findInput?: IEmployeeAwardFindInput,
		relations?: string[]
	): Observable<{ items: IEmployeeAward[]; total: number }> {
		const data = JSON.stringify({ relations, findInput });

		return this.http.get<{ items: IEmployeeAward[]; total: number }>(
			`/api/employee-award`,
			{
				params: { data }
			}
		);
	}

	update(id: string, updateInput: any): Observable<any> {
		return this.http.put(`/api/employee-award/${id}`, updateInput);
	}

	delete(id: string): Observable<any> {
		return this.http.delete(`/api/employee-award/${id}`);
	}
}
