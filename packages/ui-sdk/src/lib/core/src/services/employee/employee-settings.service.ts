import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { IEmployeeSetting, IEmployeeSettingFindInput } from '@gauzy/contracts';
import { firstValueFrom } from 'rxjs';
import { API_PREFIX } from '@gauzy/ui-sdk/common';

@Injectable({
	providedIn: 'root'
})
export class EmployeeSettingService {
	constructor(private http: HttpClient) {}

	create(createInput: IEmployeeSetting): Promise<any> {
		return firstValueFrom(this.http.post<IEmployeeSetting>(`${API_PREFIX}/employee-setting`, createInput));
	}

	getAll(
		relations?: string[],
		findInput?: IEmployeeSettingFindInput
	): Promise<{
		items: IEmployeeSetting[];
		total: number;
	}> {
		const data = JSON.stringify({ relations, findInput });

		return firstValueFrom(
			this.http.get<{
				items: IEmployeeSetting[];
				total: number;
			}>(`${API_PREFIX}/employee-setting`, {
				params: { data }
			})
		);
	}

	delete(id: string): Promise<any> {
		return firstValueFrom(this.http.delete(`${API_PREFIX}/employee-setting/${id}`));
	}

	update(id: string, updateInput: IEmployeeSetting): Promise<any> {
		return firstValueFrom(this.http.put(`${API_PREFIX}/employee-setting/${id}`, updateInput));
	}
}
