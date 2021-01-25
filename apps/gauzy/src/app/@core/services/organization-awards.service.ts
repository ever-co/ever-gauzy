import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import {
	IOrganizationAwardsCreateInput,
	IOrganizationAwards,
	IOrganizationAwardsFindInput
} from '@gauzy/contracts';
import { first } from 'rxjs/operators';

@Injectable({
	providedIn: 'root'
})
export class OrganizationAwardsService {
	constructor(private http: HttpClient) {}

	create(
		createInput: IOrganizationAwardsCreateInput
	): Promise<IOrganizationAwards> {
		return this.http
			.post<IOrganizationAwards>('/api/organization-awards', createInput)
			.pipe(first())
			.toPromise();
	}

	getAll(
		findInput?: IOrganizationAwardsFindInput,
		relations?: string[]
	): Promise<{ items: IOrganizationAwards[]; total: number }> {
		const data = JSON.stringify({ relations, findInput });

		return this.http
			.get<{ items: IOrganizationAwards[]; total: number }>(
				`/api/organization-awards`,
				{
					params: { data }
				}
			)
			.pipe(first())
			.toPromise();
	}

	update(id: string, updateInput: any): Promise<any> {
		return this.http
			.put(`/api/organization-awards/${id}`, updateInput)
			.pipe(first())
			.toPromise();
	}

	delete(id: string): Promise<any> {
		return this.http
			.delete(`/api/organization-awards/${id}`)
			.pipe(first())
			.toPromise();
	}
}
