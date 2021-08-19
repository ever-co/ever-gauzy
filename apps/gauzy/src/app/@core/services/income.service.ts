import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import {
	IIncome,
	IIncomeCreateInput,
	IIncomeFindInput,
	IIncomeUpdateInput,
	IPagination
} from '@gauzy/contracts';
import { first } from 'rxjs/operators';
import { API_PREFIX } from '../constants/app.constants';

@Injectable()
export class IncomeService {
	constructor(private http: HttpClient) {}

	create(createInput: IIncomeCreateInput): Promise<IIncome> {
		return this.http
			.post<IIncome>(`${API_PREFIX}/income`, createInput)
			.pipe(first())
			.toPromise();
	}

	getMyAll(
		relations?: string[],
		findInput?: IIncomeFindInput,
		filterDate?: Date
	): Promise<IPagination<IIncome>> {
		const data = JSON.stringify({ relations, findInput, filterDate });
		return this.http
			.get<IPagination<IIncome>>(
				`${API_PREFIX}/income/me`,
				{
					params: { data }
				}
			)
			.pipe(first())
			.toPromise();
	}

	getAll(
		relations?: string[],
		findInput?: IIncomeFindInput,
		filterDate?: Date
	): Promise<IPagination<IIncome>> {
		const data = JSON.stringify({ relations, findInput, filterDate });
		return this.http
			.get<IPagination<IIncome>>(`${API_PREFIX}/income`, {
				params: { data }
			})
			.pipe(first())
			.toPromise();
	}

	update(id: string, updateInput: IIncomeUpdateInput): Promise<IIncome> {
		return this.http
			.put<IIncome>(`${API_PREFIX}/income/${id}`, updateInput)
			.pipe(first())
			.toPromise();
	}

	delete(incomeId: string, employeeId: string): Promise<any> {
		const data = JSON.stringify({ employeeId });
		return this.http
			.delete(`${API_PREFIX}/income/${incomeId}`, {
				params: { data }
			})
			.pipe(first())
			.toPromise();
	}
}
