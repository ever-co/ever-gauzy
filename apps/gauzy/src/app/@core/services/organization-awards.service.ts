import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import {
	OrganizationAwardsCreateInput,
	OrganizationAwards,
	OrganizationAwardsFindInput
} from '@gauzy/models';
import { first } from 'rxjs/operators';

@Injectable({
	providedIn: 'root'
})
export class OrganizationAwardsService {
	constructor(private http: HttpClient) {}

	create(
		createInput: OrganizationAwardsCreateInput
	): Promise<OrganizationAwards> {
		return this.http
			.post<OrganizationAwards>('/api/organization-awards', createInput)
			.pipe(first())
			.toPromise();
	}

	getAll(
		findInput?: OrganizationAwardsFindInput,
		relations?: string[]
	): Promise<{ items: OrganizationAwards[]; total: number }> {
		const data = JSON.stringify({ relations, findInput });

		return this.http
			.get<{ items: OrganizationAwards[]; total: number }>(
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
