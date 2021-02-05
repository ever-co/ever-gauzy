import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import {
	IEmployeeRecurringExpense,
	IEmployeeRecurringExpenseByMonthFindInput,
	IEmployeeRecurringExpenseFindInput,
	IFindStartDateUpdateTypeInput,
	IStartUpdateTypeInfo,
	IRecurringExpenseDeleteInput,
	IRecurringExpenseOrderFields
} from '@gauzy/contracts';
import { first } from 'rxjs/operators';
import { API_PREFIX } from '../constants/app.constants';

@Injectable({
	providedIn: 'root'
})
export class EmployeeRecurringExpenseService {
	private readonly API_URL = `${API_PREFIX}/employee-recurring-expense`;

	constructor(private http: HttpClient) {}

	create(createInput: IEmployeeRecurringExpense): Promise<any> {
		return this.http
			.post<IEmployeeRecurringExpense>(this.API_URL, createInput)
			.pipe(first())
			.toPromise();
	}

	getAll(
		relations?: string[],
		findInput?: IEmployeeRecurringExpenseFindInput,
		order?: IRecurringExpenseOrderFields
	): Promise<{
		items: IEmployeeRecurringExpense[];
		total: number;
	}> {
		const data = JSON.stringify({ relations, findInput, order });

		return this.http
			.get<{
				items: IEmployeeRecurringExpense[];
				total: number;
			}>(this.API_URL, {
				params: { data }
			})
			.pipe(first())
			.toPromise();
	}

	getAllByMonth(
		relations?: string[],
		findInput?: IEmployeeRecurringExpenseByMonthFindInput
	): Promise<{
		items: IEmployeeRecurringExpense[];
		total: number;
	}> {
		const data = JSON.stringify({ relations, findInput });

		return this.http
			.get<{
				items: IEmployeeRecurringExpense[];
				total: number;
			}>(`${this.API_URL}/month`, {
				params: { data }
			})
			.pipe(first())
			.toPromise();
	}

	delete(
		id: string,
		deleteInput: IRecurringExpenseDeleteInput
	): Promise<any> {
		const data = JSON.stringify({ deleteInput });

		return this.http
			.delete(`${this.API_URL}/${id}`, {
				params: { data }
			})
			.pipe(first())
			.toPromise();
	}

	update(id: string, updateInput: IEmployeeRecurringExpense): Promise<any> {
		return this.http
			.put(`${this.API_URL}/${id}`, updateInput)
			.pipe(first())
			.toPromise();
	}

	getStartDateUpdateType(
		findInput?: IFindStartDateUpdateTypeInput
	): Promise<IStartUpdateTypeInfo> {
		const data = JSON.stringify({ findInput });

		return this.http
			.get<IStartUpdateTypeInfo>(`${this.API_URL}/date-update-type`, {
				params: { data }
			})
			.pipe(first())
			.toPromise();
	}
}
