import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import {
	EmployeeRecurringExpense,
	EmployeeRecurringExpenseByMonthFindInput,
	RecurringExpenseDeleteInput
} from '@gauzy/models';
import { first } from 'rxjs/operators';

@Injectable({
	providedIn: 'root'
})
export class EmployeeRecurringExpenseService {
	constructor(private http: HttpClient) {}

	create(createInput: EmployeeRecurringExpense): Promise<any> {
		return this.http
			.post<EmployeeRecurringExpense>(
				'/api/employee-recurring-expense',
				createInput
			)
			.pipe(first())
			.toPromise();
	}

	getAll(
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
			}>('/api/employee-recurring-expense/month', {
				params: { data }
			})
			.pipe(first())
			.toPromise();
	}

	delete(id: string, deleteInput: RecurringExpenseDeleteInput): Promise<any> {
		const data = JSON.stringify({ deleteInput });

		return this.http
			.delete(`/api/employee-recurring-expense/${id}`, {
				params: { data }
			})
			.pipe(first())
			.toPromise();
	}

	update(id: string, updateInput: EmployeeRecurringExpense): Promise<any> {
		return this.http
			.put(`/api/employee-recurring-expense/${id}`, updateInput)
			.pipe(first())
			.toPromise();
	}
}
