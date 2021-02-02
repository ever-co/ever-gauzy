import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import {
	IIncome,
	IIncomeCreateInput,
	IIncomeFindInput,
	IIncomeUpdateInput
} from '@gauzy/contracts';
import { first } from 'rxjs/operators';
import { API_PREFIX } from '../constants/app.constants';

@Injectable()
export class IncomeService {
	constructor(private http: HttpClient) {}

	create(createInput: IIncomeCreateInput): Promise<IIncome> {
		return this.http
			.post<IIncome>(`${API_PREFIX}/income/create`, createInput)
			.pipe(first())
			.toPromise();
	}

	getMyAll(
		relations?: string[],
		findInput?: IIncomeFindInput,
		filterDate?: Date
	): Promise<{ items: IIncome[]; total: number }> {
		const data = JSON.stringify({ relations, findInput, filterDate });

		return this.http
			.get<{ items: IIncome[]; total: number }>(
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
	): Promise<{ items: IIncome[]; total: number }> {
		const data = JSON.stringify({ relations, findInput, filterDate });

		return this.http
			.get<{ items: IIncome[]; total: number }>(`${API_PREFIX}/income`, {
				params: { data }
			})
			.pipe(first())
			.toPromise();
	}

	update(id: string, updateInput: IIncomeUpdateInput): Promise<any> {
		return this.http
			.put(`${API_PREFIX}/income/${id}`, updateInput)
			.pipe(first())
			.toPromise();
	}

	delete(incomeId: string, employeeId: string): Promise<any> {
		const data = JSON.stringify({ incomeId, employeeId });
		return this.http
			.delete(`${API_PREFIX}/income/deleteIncome`, {
				params: { data }
			})
			.pipe(first())
			.toPromise();
	}
}
