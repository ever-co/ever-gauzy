import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import {
	IIncome,
	IIncomeCreateInput,
	IIncomeFindInput,
	IIncomeUpdateInput
} from '@gauzy/models';
import { first } from 'rxjs/operators';

@Injectable()
export class IncomeService {
	constructor(private http: HttpClient) {}

	create(createInput: IIncomeCreateInput): Promise<IIncome> {
		return this.http
			.post<IIncome>('/api/income/create', createInput)
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
			.get<{ items: IIncome[]; total: number }>(`/api/income/me`, {
				params: { data }
			})
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
			.get<{ items: IIncome[]; total: number }>(`/api/income`, {
				params: { data }
			})
			.pipe(first())
			.toPromise();
	}

	update(id: string, updateInput: IIncomeUpdateInput): Promise<any> {
		return this.http
			.put(`/api/income/${id}`, updateInput)
			.pipe(first())
			.toPromise();
	}

	delete(incomeId: string, employeeId: string): Promise<any> {
		const data = JSON.stringify({ incomeId, employeeId });
		return this.http
			.delete('/api/income/deleteIncome', {
				params: { data }
			})
			.pipe(first())
			.toPromise();
	}
}
