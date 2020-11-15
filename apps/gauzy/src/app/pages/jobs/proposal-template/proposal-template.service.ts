import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { IEmployeeProposalTemplate, IPagination } from '@gauzy/models';
import { toParams } from '@gauzy/utils';
import { first } from 'rxjs/operators';

@Injectable({
	providedIn: 'root'
})
export class ProposalTemplateService {
	API_URL = 'api/employee-proposal-template';

	constructor(private http: HttpClient) {}

	getAll(request: any = {}) {
		return this.http
			.get<IPagination<IEmployeeProposalTemplate>>(this.API_URL, {
				params: toParams(request)
			})
			.pipe(first())
			.toPromise();
	}

	create(request) {
		return this.http
			.post<IEmployeeProposalTemplate>(this.API_URL, request)
			.pipe(first())
			.toPromise();
	}

	update(id, request: IEmployeeProposalTemplate) {
		return this.http
			.put<IEmployeeProposalTemplate>(`${this.API_URL}/${id}`, request)
			.pipe(first())
			.toPromise();
	}

	delete(id: string) {
		return this.http
			.delete(`${this.API_URL}/${id}`)
			.pipe(first())
			.toPromise();
	}
}
