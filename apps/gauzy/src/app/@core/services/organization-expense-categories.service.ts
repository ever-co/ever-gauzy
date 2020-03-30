import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import {
	IOrganizationVendorCreateInput,
	IOrganizationVendor,
	IOrganizationVendorFindInput
} from '@gauzy/models';
import { first } from 'rxjs/operators';

@Injectable({
	providedIn: 'root'
})
export class OrganizationExpenseCategoriesService {
	constructor(private http: HttpClient) {}

	create(
		createInput: IOrganizationVendorCreateInput
	): Promise<IOrganizationVendor> {
		return this.http
			.post<IOrganizationVendor>(
				'/api/organization-expense-categories',
				createInput
			)
			.pipe(first())
			.toPromise();
	}

	getAll(
		findInput?: IOrganizationVendorFindInput
	): Promise<{ items: any[]; total: number }> {
		const data = JSON.stringify({ findInput });

		return this.http
			.get<{ items: IOrganizationVendor[]; total: number }>(
				`/api/organization-expense-categories`,
				{
					params: { data }
				}
			)
			.pipe(first())
			.toPromise();
	}

	update(id: string, updateInput: any): Promise<any> {
		return this.http
			.put(`/api/organization-vendors/${id}`, updateInput)
			.pipe(first())
			.toPromise();
	}

	delete(id: string): Promise<any> {
		return this.http
			.delete(`/api/organization-expense-categories/${id}`)
			.pipe(first())
			.toPromise();
	}
}
