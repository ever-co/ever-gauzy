import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import {
	IOrganizationPositionCreateInput,
	IOrganizationPosition,
	IOrganizationPositionFindInput
} from '@gauzy/contracts';
import { first } from 'rxjs/operators';

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
				'/api/organization-positions',
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
				`/api/organization-positions`,
				{
					params: { data }
				}
			)
			.pipe(first())
			.toPromise();
	}

	update(id: string, updateInput: any): Promise<any> {
		return this.http
			.put(`/api/organization-positions/${id}`, updateInput)
			.pipe(first())
			.toPromise();
	}

	delete(id: string): Promise<any> {
		return this.http
			.delete(`/api/organization-positions/${id}`)
			.pipe(first())
			.toPromise();
	}
}
