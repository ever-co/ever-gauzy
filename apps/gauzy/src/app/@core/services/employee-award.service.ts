import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import {
	IEmployeeAward,
	IEmployeeAwardFindInput,
	IEmployeeAwardCreateInput
} from '@gauzy/contracts';
import { Observable } from 'rxjs';
import { API_PREFIX } from '../constants/app.constants';

@Injectable({
	providedIn: 'root'
})
export class EmployeeAwardService {
	constructor(private http: HttpClient) {}

	create(createInput: IEmployeeAwardCreateInput): Observable<IEmployeeAward> {
		return this.http.post<IEmployeeAward>(
			`${API_PREFIX}/employee-award`,
			createInput
		);
	}

	getAll(
		findInput?: IEmployeeAwardFindInput,
		relations?: string[]
	): Observable<{ items: IEmployeeAward[]; total: number }> {
		const data = JSON.stringify({ relations, findInput });

		return this.http.get<{ items: IEmployeeAward[]; total: number }>(
			`${API_PREFIX}/employee-award`,
			{
				params: { data }
			}
		);
	}

	update(id: string, updateInput: any): Observable<any> {
		return this.http.put(`${API_PREFIX}/employee-award/${id}`, updateInput);
	}

	delete(id: string): Observable<any> {
		return this.http.delete(`${API_PREFIX}/employee-award/${id}`);
	}
}
