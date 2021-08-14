import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import {
	IExpense,
	IExpenseCreateInput,
	IExpenseFindInput,
	IExpenseReportData,
	IExpenseUpdateInput,
	IPagination,
	ISplitExpenseOutput
} from '@gauzy/contracts';
import { toParams } from '@gauzy/common-angular';
import { first } from 'rxjs/operators';
import { API_PREFIX } from '../constants/app.constants';

@Injectable({
	providedIn: 'root'
})
export class ExpensesService {
	constructor(private http: HttpClient) {}

	create(createInput: IExpenseCreateInput): Promise<IExpense> {
		return this.http
			.post<IExpense>(`${API_PREFIX}/expense`, createInput)
			.pipe(first())
			.toPromise();
	}

	getMyAllWithSplitExpenses(
		relations?: string[],
		filterDate?: Date
	): Promise<IPagination<ISplitExpenseOutput>> {
		const data = JSON.stringify({ relations, filterDate });
		return this.http
			.get<IPagination<ISplitExpenseOutput>>(
				`${API_PREFIX}/expense/me`,
				{
					params: { data }
				}
			)
			.pipe(first())
			.toPromise();
	}

	getById(id: string): Promise<IExpense> {
		return this.http
			.get<IExpense>(`${API_PREFIX}/expense/${id}`)
			.pipe(first())
			.toPromise();
	}

	getAllWithSplitExpenses(
		employeeId: string,
		relations?: string[],
		filterDate?: Date
	): Promise<IPagination<ISplitExpenseOutput>> {
		const data = JSON.stringify({ relations, filterDate });
		return this.http
			.get<IPagination<ISplitExpenseOutput>>(
				`${API_PREFIX}/expense/include-split/${employeeId}`,
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
	): Promise<IPagination<IExpense>> {
		const data = JSON.stringify({ relations, findInput, filterDate });
		return this.http
			.get<IPagination<IExpense>>(
				`${API_PREFIX}/expense`,
				{
					params: { data }
				}
			)
			.pipe(first())
			.toPromise();
	}

	update(id: string, updateInput: IExpenseUpdateInput): Promise<IExpense> {
		return this.http
			.put<IExpense>(`${API_PREFIX}/expense/${id}`, updateInput)
			.pipe(first())
			.toPromise();
	}

	delete(expenseId: string, employeeId: string): Promise<any> {
		const data = JSON.stringify({ employeeId });
		return this.http
			.delete(`${API_PREFIX}/expense/${expenseId}`, {
				params: { data }
			})
			.pipe(first())
			.toPromise();
	}

	getDailyExpensesReport(request: any = {}) {
		return this.http
			.get<IExpenseReportData[]>(`${API_PREFIX}/expense/report`, {
				params: toParams(request)
			})
			.pipe(first())
			.toPromise();
	}

	getReportChartData(request: any = {}) {
		return this.http
			.get<IExpenseReportData[]>(
				`${API_PREFIX}/expense/report/daily-chart`,
				{
					params: toParams(request)
				}
			)
			.pipe(first())
			.toPromise();
	}
}
