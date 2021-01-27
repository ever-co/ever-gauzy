import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import {
	IFindStartDateUpdateTypeInput,
	IStartUpdateTypeInfo,
	IOrganizationRecurringExpense,
	IOrganizationRecurringExpenseFindInput,
	IOrganizationRecurringExpenseForEmployeeOutput,
	IRecurringExpenseDeleteInput,
	IRecurringExpenseOrderFields
} from '@gauzy/contracts';
import { first } from 'rxjs/operators';

@Injectable({
	providedIn: 'root'
})
export class OrganizationRecurringExpenseService {
	private readonly API_URL = '/api/organization-recurring-expense';

	constructor(private http: HttpClient) {}

	create(createInput: IOrganizationRecurringExpense): Promise<any> {
		return this.http
			.post<IOrganizationRecurringExpense>(this.API_URL, createInput)
			.pipe(first())
			.toPromise();
	}

	getAll(
		relations?: string[],
		findInput?: IOrganizationRecurringExpenseFindInput,
		order?: IRecurringExpenseOrderFields
	): Promise<{
		items: IOrganizationRecurringExpense[];
		total: number;
	}> {
		const data = JSON.stringify({ relations, findInput, order });

		return this.http
			.get<{
				items: IOrganizationRecurringExpense[];
				total: number;
			}>(this.API_URL, {
				params: { data }
			})
			.pipe(first())
			.toPromise();
	}

	getAllByMonth(
		findInput?: IOrganizationRecurringExpenseFindInput
	): Promise<{
		items: IOrganizationRecurringExpense[];
		total: number;
	}> {
		const data = JSON.stringify({ findInput });

		return this.http
			.get<{
				items: IOrganizationRecurringExpense[];
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

	update(
		id: string,
		updateInput: IOrganizationRecurringExpense
	): Promise<any> {
		return this.http
			.put(`${this.API_URL}/${id}`, updateInput)
			.pipe(first())
			.toPromise();
	}

	getSplitExpensesForEmployee(
		orgId: string,
		findInput?: IOrganizationRecurringExpenseFindInput
	): Promise<{
		items: IOrganizationRecurringExpenseForEmployeeOutput[];
		total: number;
	}> {
		const data = JSON.stringify({ findInput });

		return this.http
			.get<{
				items: IOrganizationRecurringExpenseForEmployeeOutput[];
				total: number;
			}>(`${this.API_URL}/employee/${orgId}`, {
				params: { data }
			})
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
