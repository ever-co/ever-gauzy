import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import {
	IOrganizationExpenseCategoryCreateInput,
	IOrganizationExpenseCategory,
	IOrganizationExpenseCategoryFindInput
} from '@gauzy/contracts';
import { API_PREFIX, toParams } from '@gauzy/ui-core/common';

@Injectable({
	providedIn: 'root'
})
export class OrganizationExpenseCategoriesService {
	constructor(private http: HttpClient) {}

	create(createInput: IOrganizationExpenseCategoryCreateInput): Promise<IOrganizationExpenseCategory> {
		return firstValueFrom(
			this.http.post<IOrganizationExpenseCategory>(`${API_PREFIX}/expense-categories`, createInput)
		);
	}

	getAll(
		findInput?: IOrganizationExpenseCategoryFindInput,
		relations?: string[]
	): Promise<{ items: any[]; total: number }> {
		const data = JSON.stringify({ findInput, relations });

		return firstValueFrom(
			this.http.get<{ items: IOrganizationExpenseCategory[]; total: number }>(
				`${API_PREFIX}/expense-categories`,
				{
					// `data` is kept for the tenant guard; the route only filters on `where`.
					params: toParams({
						data,
						...(findInput ? { where: findInput } : {}),
						...(relations?.length ? { relations } : {})
					})
				}
			)
		);
	}

	update(id: string, updateInput: any): Promise<any> {
		return firstValueFrom(this.http.put(`${API_PREFIX}/expense-categories/${id}`, updateInput));
	}

	delete(id: string): Promise<any> {
		return firstValueFrom(this.http.delete(`${API_PREFIX}/expense-categories/${id}`));
	}
}
