import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import {
	OrganizationVendorsCreateInput,
	OrganizationVendors,
	OrganizationVendorsFindInput
} from '@gauzy/models';
import { first } from 'rxjs/operators';

@Injectable({
	providedIn: 'root'
})
export class OrganizationVendorsService {
	constructor(private http: HttpClient) {}

	create(
		createInput: OrganizationVendorsCreateInput
	): Promise<OrganizationVendors> {
		return this.http
			.post<OrganizationVendors>('/api/organization-vendors', createInput)
			.pipe(first())
			.toPromise();
	}

	getAll(
		findInput?: OrganizationVendorsFindInput
	): Promise<{ items: any[]; total: number }> {
		const data = JSON.stringify({ findInput });

		return this.http
			.get<{ items: OrganizationVendors[]; total: number }>(
				`/api/organization-vendors`,
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
			.delete(`/api/organization-vendors/${id}`)
			.pipe(first())
			.toPromise();
	}
}
