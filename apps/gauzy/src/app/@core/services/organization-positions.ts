import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import {
	IOrganizationPositionCreateInput,
	IOrganizationPosition,
	IOrganizationPositionFindInput
} from '@gauzy/contracts';
import { first } from 'rxjs/operators';
import { API_PREFIX } from '../constants/app.constants';

@Injectable({
	providedIn: 'root'
})
export class OrganizationPositionsService {
	constructor(private http: HttpClient) {}

	create(
		createInput: IOrganizationPositionCreateInput
	): Promise<IOrganizationPosition> {
		return this.http
			.post<IOrganizationPosition>(
				`${API_PREFIX}/organization-positions`,
				createInput
			)
			.pipe(first())
			.toPromise();
	}

	getAll(
		findInput?: IOrganizationPositionFindInput,
		relations?: string[]
	): Promise<{ items: any[]; total: number }> {
		const data = JSON.stringify({ relations, findInput });

		return this.http
			.get<{ items: IOrganizationPosition[]; total: number }>(
				`${API_PREFIX}/organization-positions`,
				{
					params: { data }
				}
			)
			.pipe(first())
			.toPromise();
	}

	update(id: string, updateInput: any): Promise<any> {
		return this.http
			.put(`${API_PREFIX}/organization-positions/${id}`, updateInput)
			.pipe(first())
			.toPromise();
	}

	delete(id: string): Promise<any> {
		return this.http
			.delete(`${API_PREFIX}/organization-positions/${id}`)
			.pipe(first())
			.toPromise();
	}
}
