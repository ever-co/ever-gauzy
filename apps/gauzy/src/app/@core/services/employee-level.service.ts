import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { IEmployeeLevelInput, IEmployeeLevel, IEmployeeLevelFindInput, IPagination } from '@gauzy/contracts';
import { firstValueFrom } from 'rxjs';
import { API_PREFIX } from '@gauzy/ui-sdk/common';

@Injectable({
	providedIn: 'root'
})
export class EmployeeLevelService {
	constructor(private http: HttpClient) {}

	getAll(relations?: string[], findInput?: IEmployeeLevelFindInput): Promise<IPagination<IEmployeeLevel>> {
		const data = JSON.stringify({ relations: relations || [], findInput });
		return firstValueFrom(
			this.http.get<IPagination<IEmployeeLevel>>(`${API_PREFIX}/employee-level`, {
				params: { data }
			})
		);
	}

	create(employeeLevel: IEmployeeLevelInput) {
		return firstValueFrom(this.http.post(`${API_PREFIX}/employee-level`, employeeLevel));
	}

	delete(id: string) {
		return firstValueFrom(this.http.delete(`${API_PREFIX}/employee-level/${id}`));
	}

	update(id: string, employeeLevel: IEmployeeLevelInput) {
		return firstValueFrom(this.http.put(`${API_PREFIX}/employee-level/${id}`, employeeLevel));
	}
}
