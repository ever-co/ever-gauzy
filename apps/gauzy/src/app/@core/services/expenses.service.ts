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
import { toParams } from '@gauzy/ui-sdk/common';
import { firstValueFrom } from 'rxjs';
import { API_PREFIX } from '../constants/app.constants';

@Injectable({
	providedIn: 'root'
})
export class ExpensesService {
	constructor(private http: HttpClient) {}

	create(createInput: IExpenseCreateInput): Promise<IExpense> {
		return firstValueFrom(this.http.post<IExpense>(`${API_PREFIX}/expense`, createInput));
	}

	getMyAllWithSplitExpenses(relations?: string[], filterDate?: Date): Promise<IPagination<ISplitExpenseOutput>> {
		const data = JSON.stringify({ relations, filterDate });
		return firstValueFrom(
			this.http.get<IPagination<ISplitExpenseOutput>>(`${API_PREFIX}/expense/me`, {
				params: { data }
			})
		);
	}

	getById(id: string): Promise<IExpense> {
		return firstValueFrom(this.http.get<IExpense>(`${API_PREFIX}/expense/${id}`));
	}

	getAllWithSplitExpenses(
		employeeId: string,
		relations?: string[],
		filterDate?: Date
	): Promise<IPagination<ISplitExpenseOutput>> {
		const data = JSON.stringify({ relations, filterDate });
		return firstValueFrom(
			this.http.get<IPagination<ISplitExpenseOutput>>(`${API_PREFIX}/expense/include-split/${employeeId}`, {
				params: { data }
			})
		);
	}

	getAll(relations?: string[], findInput?: IExpenseFindInput, filterDate?: Date): Promise<IPagination<IExpense>> {
		const data = JSON.stringify({ relations, findInput, filterDate });

		return firstValueFrom(
			this.http.get<IPagination<IExpense>>(`${API_PREFIX}/expense`, {
				params: { data }
			})
		);
	}

	update(id: string, updateInput: IExpenseUpdateInput): Promise<IExpense> {
		return firstValueFrom(this.http.put<IExpense>(`${API_PREFIX}/expense/${id}`, updateInput));
	}

	delete(expenseId: string, input: IExpenseFindInput): Promise<any> {
		return firstValueFrom(
			this.http.delete(`${API_PREFIX}/expense/${expenseId}`, {
				params: toParams({ ...input })
			})
		);
	}

	getDailyExpensesReport(request: any = {}) {
		return firstValueFrom(
			this.http.get<IExpenseReportData[]>(`${API_PREFIX}/expense/report`, {
				params: toParams(request)
			})
		);
	}

	/**
	 * Retrieves expense report chart data based on the provided request parameters.
	 * @param request - The request parameters for fetching expense report data.
	 * @returns A Promise that resolves to an array of IExpenseReportData objects.
	 */
	getExpenseReportCharts(request: any = {}): Promise<IExpenseReportData[]> {
		// Construct the URL for the API endpoint
		const url = `${API_PREFIX}/expense/report/daily-chart`;

		// Convert the request parameters to an HTTP params object
		const params = toParams(request);

		// Make an HTTP GET request using Angular's HttpClient, and convert the observable to a Promise
		return firstValueFrom(this.http.get<IExpenseReportData[]>(url, { params }));
	}
}
