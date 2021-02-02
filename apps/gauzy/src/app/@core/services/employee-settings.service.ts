import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { IEmployeeSetting, IEmployeeSettingFindInput } from '@gauzy/contracts';
import { first } from 'rxjs/operators';
import { API_PREFIX } from '../constants/app.constants';

@Injectable({
	providedIn: 'root'
})
export class EmployeeSettingService {
	constructor(private http: HttpClient) {}

	create(createInput: IEmployeeSetting): Promise<any> {
		return this.http
			.post<IEmployeeSetting>(
				`${API_PREFIX}/employee-setting`,
				createInput
			)
			.pipe(first())
			.toPromise();
	}

	getAll(
		relations?: string[],
		findInput?: IEmployeeSettingFindInput
	): Promise<{
		items: IEmployeeSetting[];
		total: number;
	}> {
		const data = JSON.stringify({ relations, findInput });

		return this.http
			.get<{
				items: IEmployeeSetting[];
				total: number;
			}>(`${API_PREFIX}/employee-setting`, {
				params: { data }
			})
			.pipe(first())
			.toPromise();
	}

	delete(id: string): Promise<any> {
		return this.http
			.delete(`${API_PREFIX}/employee-setting/${id}`)
			.pipe(first())
			.toPromise();
	}

	update(id: string, updateInput: IEmployeeSetting): Promise<any> {
		return this.http
			.put(`${API_PREFIX}/employee-setting/${id}`, updateInput)
			.pipe(first())
			.toPromise();
	}
}
