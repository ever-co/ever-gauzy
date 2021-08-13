import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import {
	IOrganizationAwardCreateInput,
	IOrganizationAward,
	IOrganizationAwardFindInput
} from '@gauzy/contracts';
import { first } from 'rxjs/operators';
import { API_PREFIX } from '../constants/app.constants';

@Injectable({
	providedIn: 'root'
})
export class OrganizationAwardsService {
	constructor(private http: HttpClient) {}

	create(
		createInput: IOrganizationAwardCreateInput
	): Promise<IOrganizationAward> {
		return this.http
			.post<IOrganizationAward>(
				`${API_PREFIX}/organization-awards`,
				createInput
			)
			.pipe(first())
			.toPromise();
	}

	getAll(
		findInput?: IOrganizationAwardFindInput,
		relations?: string[]
	): Promise<{ items: IOrganizationAward[]; total: number }> {
		const data = JSON.stringify({ relations, findInput });

		return this.http
			.get<{ items: IOrganizationAward[]; total: number }>(
				`${API_PREFIX}/organization-awards`,
				{
					params: { data }
				}
			)
			.pipe(first())
			.toPromise();
	}

	update(id: string, updateInput: any): Promise<any> {
		return this.http
			.put(`${API_PREFIX}/organization-awards/${id}`, updateInput)
			.pipe(first())
			.toPromise();
	}

	delete(id: string): Promise<any> {
		return this.http
			.delete(`${API_PREFIX}/organization-awards/${id}`)
			.pipe(first())
			.toPromise();
	}
}
