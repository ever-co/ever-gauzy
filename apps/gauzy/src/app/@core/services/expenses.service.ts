import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import {
	IExpense,
	IExpenseCreateInput,
	IExpenseFindInput,
	IExpenseReportData,
	IExpenseUpdateInput,
	ISplitExpenseOutput
} from '@gauzy/contracts';
import { toParams } from '@gauzy/common-angular';
import { first } from 'rxjs/operators';

@Injectable({
	providedIn: 'root'
})
export class ExpensesService {
	constructor(private http: HttpClient) {}

	create(createInput: IExpenseCreateInput): Promise<any> {
		return this.http
			.post<IExpense>('/api/expense/create', createInput)
			.pipe(first())
			.toPromise();
	}

	getMyAllWithSplitExpenses(
		relations?: string[],
		filterDate?: Date
	): Promise<{ items: ISplitExpenseOutput[]; total: number }> {
		const data = JSON.stringify({ relations, filterDate });

		return this.http
			.get<{ items: ISplitExpenseOutput[]; total: number }>(
				`/api/expense/me`,
				{
					params: { data }
				}
			)
			.pipe(first())
			.toPromise();
	}

	getById(id: string) {
		return this.http
			.get<IExpense>(`/api/expense/${id}`)
			.pipe(first())
			.toPromise();
	}

	getAllWithSplitExpenses(
		employeeId: string,
		relations?: string[],
		filterDate?: Date
	): Promise<{ items: ISplitExpenseOutput[]; total: number }> {
		const data = JSON.stringify({ relations, filterDate });

		return this.http
			.get<{ items: ISplitExpenseOutput[]; total: number }>(
				`/api/expense/include-split/${employeeId}`,
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
	): Promise<{ items: IExpense[]; total: number }> {
		const data = JSON.stringify({ relations, findInput, filterDate });

		return this.http
			.get<{ items: IExpense[]; total: number }>(`/api/expense`, {
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

	delete(expenseId: string, employeeId: string): Promise<any> {
		const data = JSON.stringify({ expenseId, employeeId });
		return this.http
			.delete('/api/expense/deleteExpense', {
				params: { data }
			})
			.pipe(first())
			.toPromise();
	}

	getDailyExpensesReport(request: any = {}) {
		return this.http
			.get<IExpenseReportData[]>(`/api/expense/report`, {
				params: toParams(request)
			})
			.pipe(first())
			.toPromise();
	}

	getReportChartData(request: any = {}) {
		return this.http
			.get<IExpenseReportData[]>(`/api/expense/report/daily-chart`, {
				params: toParams(request)
			})
			.pipe(first())
			.toPromise();
	}
}
