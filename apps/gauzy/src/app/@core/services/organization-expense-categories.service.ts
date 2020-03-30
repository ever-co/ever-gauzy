import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { first } from 'rxjs/operators';

// tslint:disable-next-line: nx-enforce-module-boundaries
import {
	IOrganizationExpenseCategoryCreateInput,
	IOrganizationExpenseCategory,
	IOrganizationExpenseCategoryFindInput
} from 'libs/models/src/lib/organization-expense-category.model';

@Injectable({
	providedIn: 'root'
})
export class OrganizationExpenseCategoriesService {
	constructor(private http: HttpClient) {}

	create(
		createInput: IOrganizationExpenseCategoryCreateInput
	): Promise<IOrganizationExpenseCategory> {
		return this.http
			.post<IOrganizationExpenseCategory>(
				'/api/expense-categories',
				createInput
			)
			.pipe(first())
			.toPromise();
	}

	getAll(
		findInput?: IOrganizationExpenseCategoryFindInput
	): Promise<{ items: any[]; total: number }> {
		const data = JSON.stringify({ findInput });

		return this.http
			.get<{ items: IOrganizationExpenseCategory[]; total: number }>(
				`/api/expense-categories`,
				{
					params: { data }
				}
			)
			.pipe(first())
			.toPromise();
	}

	update(id: string, updateInput: any): Promise<any> {
		return this.http
			.put(`/api/expense-categories/${id}`, updateInput)
			.pipe(first())
			.toPromise();
	}

	delete(id: string): Promise<any> {
		return this.http
			.delete(`/api/expense-categories/${id}`)
			.pipe(first())
			.toPromise();
	}
}
