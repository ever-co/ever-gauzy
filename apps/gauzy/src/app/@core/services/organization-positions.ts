import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import {
	OrganizationPositionsCreateInput,
	OrganizationPositions,
	OrganizationPositionsFindInput
} from '@gauzy/models';
import { first } from 'rxjs/operators';

@Injectable({
	providedIn: 'root'
})
export class OrganizationPositionsService {
	constructor(private http: HttpClient) {}

	create(
		createInput: OrganizationPositionsCreateInput
	): Promise<OrganizationPositions> {
		return this.http
			.post<OrganizationPositions>(
				'/api/organization-positions',
				createInput
			)
			.pipe(first())
			.toPromise();
	}

	getAll(
		findInput?: OrganizationPositionsFindInput
	): Promise<{ items: any[]; total: number }> {
		const data = JSON.stringify({ findInput });

		return this.http
			.get<{ items: OrganizationPositions[]; total: number }>(
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
