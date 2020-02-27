import { Injectable, Inject, forwardRef } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import {
	Expense,
	ExpenseCreateInput as IExpenseCreateInput,
	ExpenseFindInput as IExpenseFindInput,
	ExpenseUpdateInput as IExpenseUpdateInput,
	SplitExpenseOutput
} from '@gauzy/models';
import { first } from 'rxjs/operators';

@Injectable({
	providedIn: 'root'
})
export class ExpensesService {
	constructor(private http: HttpClient) {}

	create(createInput: IExpenseCreateInput): Promise<any> {
		return this.http
			.post<Expense>('/api/expense/create', createInput)
			.pipe(first())
			.toPromise();
	}

	getMyAll(
		relations?: string[],
		findInput?: IExpenseFindInput,
		filterDate?: Date
	): Promise<{ items: Expense[]; total: number }> {
		const data = JSON.stringify({ relations, findInput, filterDate });

		return this.http
			.get<{ items: Expense[]; total: number }>(`/api/expense/me`, {
				params: { data }
			})
			.pipe(first())
			.toPromise();
	}

	getAllSplitExpenses(
		orgId: string,
		relations?: string[],
		findInput?: IExpenseFindInput,
		filterDate?: Date
	): Promise<{ items: SplitExpenseOutput[]; total: number }> {
		const data = JSON.stringify({ relations, findInput, filterDate });

		return this.http
			.get<{ items: SplitExpenseOutput[]; total: number }>(
				`/api/expense/split/${orgId}`,
				{
					params: { data }
				}
			)
			.pipe(first())
			.toPromise();
	}

	getAll(
		relations?: string[],
		findInput?: IExpenseFindInput,
		filterDate?: Date
	): Promise<{ items: Expense[]; total: number }> {
		const data = JSON.stringify({ relations, findInput, filterDate });

		return this.http
			.get<{ items: Expense[]; total: number }>(`/api/expense`, {
				params: { data }
			})
			.pipe(first())
			.toPromise();
	}

	update(id: string, updateInput: IExpenseUpdateInput): Promise<any> {
		return this.http
			.put(`/api/expense/${id}`, updateInput)
			.pipe(first())
			.toPromise();
	}

	delete(id: string): Promise<any> {
		return this.http
			.delete(`/api/expense/${id}`)
			.pipe(first())
			.toPromise();
	}
}
