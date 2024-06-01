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
import { firstValueFrom } from 'rxjs';
import { API_PREFIX } from '@gauzy/ui-sdk/common';

@Injectable({
	providedIn: 'root'
})
export class OrganizationRecurringExpenseService {
	private readonly API_URL = `${API_PREFIX}/organization-recurring-expense`;

	constructor(private http: HttpClient) {}

	create(createInput: IOrganizationRecurringExpense): Promise<any> {
		return firstValueFrom(this.http.post<IOrganizationRecurringExpense>(this.API_URL, createInput));
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

		return firstValueFrom(
			this.http.get<{
				items: IOrganizationRecurringExpense[];
				total: number;
			}>(this.API_URL, {
				params: { data }
			})
		);
	}

	getAllByMonth(findInput?: IOrganizationRecurringExpenseFindInput): Promise<{
		items: IOrganizationRecurringExpense[];
		total: number;
	}> {
		const data = JSON.stringify({ findInput });

		return firstValueFrom(
			this.http.get<{
				items: IOrganizationRecurringExpense[];
				total: number;
			}>(`${this.API_URL}/month`, {
				params: { data }
			})
		);
	}

	delete(id: string, deleteInput: IRecurringExpenseDeleteInput): Promise<any> {
		const data = JSON.stringify({ deleteInput });

		return firstValueFrom(
			this.http.delete(`${this.API_URL}/${id}`, {
				params: { data }
			})
		);
	}

	update(id: string, updateInput: IOrganizationRecurringExpense): Promise<any> {
		return firstValueFrom(this.http.put(`${this.API_URL}/${id}`, updateInput));
	}

	getSplitExpensesForEmployee(
		orgId: string,
		findInput?: IOrganizationRecurringExpenseFindInput
	): Promise<{
		items: IOrganizationRecurringExpenseForEmployeeOutput[];
		total: number;
	}> {
		const data = JSON.stringify({ findInput });

		return firstValueFrom(
			this.http.get<{
				items: IOrganizationRecurringExpenseForEmployeeOutput[];
				total: number;
			}>(`${this.API_URL}/employee/${orgId}`, {
				params: { data }
			})
		);
	}

	getStartDateUpdateType(findInput?: IFindStartDateUpdateTypeInput): Promise<IStartUpdateTypeInfo> {
		const data = JSON.stringify({ findInput });

		return firstValueFrom(
			this.http.get<IStartUpdateTypeInfo>(`${this.API_URL}/date-update-type`, {
				params: { data }
			})
		);
	}
}
