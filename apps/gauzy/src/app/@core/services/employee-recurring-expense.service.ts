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
import { firstValueFrom } from 'rxjs';
import { API_PREFIX } from '../constants/app.constants';

@Injectable({
	providedIn: 'root'
})
export class EmployeeRecurringExpenseService {
	private readonly API_URL = `${API_PREFIX}/employee-recurring-expense`;

	constructor(private http: HttpClient) {}

	create(createInput: IEmployeeRecurringExpense): Promise<any> {
		return firstValueFrom(
			this.http
			.post<IEmployeeRecurringExpense>(this.API_URL, createInput)
		);
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

		return firstValueFrom(
			this.http
			.get<{
				items: IEmployeeRecurringExpense[];
				total: number;
			}>(this.API_URL, {
				params: { data }
			})
		);
	}

	getAllByMonth(
		relations?: string[],
		findInput?: IEmployeeRecurringExpenseByMonthFindInput
	): Promise<{
		items: IEmployeeRecurringExpense[];
		total: number;
	}> {
		const data = JSON.stringify({ relations, findInput });

		return firstValueFrom(
			this.http
			.get<{
				items: IEmployeeRecurringExpense[];
				total: number;
			}>(`${this.API_URL}/month`, {
				params: { data }
			})
		);
	}

	delete(
		id: string,
		deleteInput: IRecurringExpenseDeleteInput
	): Promise<any> {
		const data = JSON.stringify({ deleteInput });

		return firstValueFrom(
			this.http
			.delete(`${this.API_URL}/${id}`, {
				params: { data }
			})
		);
	}

	update(id: string, updateInput: IEmployeeRecurringExpense): Promise<any> {
		return firstValueFrom(
			this.http
			.put(`${this.API_URL}/${id}`, updateInput)
		);
	}

	getStartDateUpdateType(
		findInput?: IFindStartDateUpdateTypeInput
	): Promise<IStartUpdateTypeInfo> {
		const data = JSON.stringify({ findInput });

		return firstValueFrom(
			this.http
			.get<IStartUpdateTypeInfo>(`${this.API_URL}/date-update-type`, {
				params: { data }
			})
		);
	}
}
