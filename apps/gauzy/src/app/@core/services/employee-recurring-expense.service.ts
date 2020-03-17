import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import {
	EmployeeRecurringExpense,
	EmployeeRecurringExpenseByMonthFindInput,
	EmployeeRecurringExpenseFindInput,
	RecurringExpenseDeleteInput,
	RecurringExpenseOrderFields
} from '@gauzy/models';
import { first } from 'rxjs/operators';

@Injectable({
	providedIn: 'root'
})
export class EmployeeRecurringExpenseService {
	private readonly API_URL = '/api/employee-recurring-expense';

	constructor(private http: HttpClient) {}

	create(createInput: EmployeeRecurringExpense): Promise<any> {
		return this.http
			.post<EmployeeRecurringExpense>(this.API_URL, createInput)
			.pipe(first())
			.toPromise();
	}

	getAll(
		relations?: string[],
		findInput?: EmployeeRecurringExpenseFindInput,
		order?: RecurringExpenseOrderFields
	): Promise<{
		items: EmployeeRecurringExpense[];
		total: number;
	}> {
		const data = JSON.stringify({ relations, findInput, order });

		return this.http
			.get<{
				items: EmployeeRecurringExpense[];
				total: number;
			}>(this.API_URL, {
				params: { data }
			})
			.pipe(first())
			.toPromise();
	}

	getAllByMonth(
		relations?: string[],
		findInput?: EmployeeRecurringExpenseByMonthFindInput
	): Promise<{
		items: EmployeeRecurringExpense[];
		total: number;
	}> {
		const data = JSON.stringify({ relations, findInput });

		return this.http
			.get<{
				items: EmployeeRecurringExpense[];
				total: number;
			}>(`${this.API_URL}/month`, {
				params: { data }
			})
			.pipe(first())
			.toPromise();
	}

	delete(id: string, deleteInput: RecurringExpenseDeleteInput): Promise<any> {
		const data = JSON.stringify({ deleteInput });

		return this.http
			.delete(`${this.API_URL}/${id}`, {
				params: { data }
			})
			.pipe(first())
			.toPromise();
	}

	update(id: string, updateInput: EmployeeRecurringExpense): Promise<any> {
		return this.http
			.put(`${this.API_URL}/${id}`, updateInput)
			.pipe(first())
			.toPromise();
	}
}
