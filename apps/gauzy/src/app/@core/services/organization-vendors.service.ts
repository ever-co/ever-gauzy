import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import {
	IOrganizationVendorCreateInput,
	IOrganizationVendor,
	IOrganizationVendorFindInput
} from '@gauzy/contracts';
import { first } from 'rxjs/operators';
import { API_PREFIX } from '../constants/app.constants';

@Injectable({
	providedIn: 'root'
})
export class OrganizationVendorsService {
	constructor(private http: HttpClient) {}

	create(
		createInput: IOrganizationVendorCreateInput
	): Promise<IOrganizationVendor> {
		return this.http
			.post<IOrganizationVendor>(
				`${API_PREFIX}/organization-vendors`,
				createInput
			)
			.pipe(first())
			.toPromise();
	}

	getAll(
		findInput?: IOrganizationVendorFindInput,
		relations?: string[],
		order?:{}
	): Promise<{ items: any[]; total: number }> {
		const data = JSON.stringify({ relations, findInput, order });

		return this.http
			.get<{ items: IOrganizationVendor[]; total: number }>(
				`${API_PREFIX}/organization-vendors`,
				{
					params: { data }
				}
			)
			.pipe(first())
			.toPromise();
	}

	update(id: string, updateInput: any): Promise<any> {
		return this.http
			.put(`${API_PREFIX}/organization-vendors/${id}`, updateInput)
			.pipe(first())
			.toPromise();
	}

	delete(id: string): Promise<any> {
		return this.http
			.delete(`${API_PREFIX}/organization-vendors/${id}`)
			.pipe(first())
			.toPromise();
	}
}
