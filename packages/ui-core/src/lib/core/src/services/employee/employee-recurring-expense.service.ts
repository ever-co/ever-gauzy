import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import {
	IEmployeeRecurringExpense,
	IEmployeeRecurringExpenseByMonthFindInput,
	IEmployeeRecurringExpenseFindInput,
	IFindStartDateUpdateTypeInput,
	IStartUpdateTypeInfo,
	IRecurringExpenseDeleteInput,
	IRecurringExpenseOrderFields,
	IPagination
} from '@gauzy/contracts';
import { toParams } from '@gauzy/ui-core/common';
import { firstValueFrom } from 'rxjs';
import { API_PREFIX } from '@gauzy/ui-core/common';

@Injectable({
	providedIn: 'root'
})
export class EmployeeRecurringExpenseService {
	private readonly API_URL = `${API_PREFIX}/employee-recurring-expense`;

	constructor(private readonly http: HttpClient) {}

	create(createInput: IEmployeeRecurringExpense): Promise<any> {
		return firstValueFrom(this.http.post<IEmployeeRecurringExpense>(this.API_URL, createInput));
	}

	getAll(
		relations: string[] = [],
		where?: IEmployeeRecurringExpenseFindInput,
		order?: IRecurringExpenseOrderFields
	): Promise<IPagination<IEmployeeRecurringExpense>> {
		return firstValueFrom(
			this.http.get<IPagination<IEmployeeRecurringExpense>>(this.API_URL, {
				params: toParams({ relations, where, order })
			})
		);
	}

	getAllByRange(
		relations?: string[],
		where?: IEmployeeRecurringExpenseByMonthFindInput
	): Promise<IPagination<IEmployeeRecurringExpense>> {
		return firstValueFrom(
			this.http.get<IPagination<IEmployeeRecurringExpense>>(`${this.API_URL}/month`, {
				params: toParams({ relations, ...where })
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

	update(id: string, updateInput: IEmployeeRecurringExpense): Promise<any> {
		return firstValueFrom(this.http.put(`${this.API_URL}/${id}`, updateInput));
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
