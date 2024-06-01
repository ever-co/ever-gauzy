import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { IEmployeeProposalTemplate, IPagination } from '@gauzy/contracts';
import { API_PREFIX, toParams } from '@gauzy/ui-sdk/common';
import { firstValueFrom } from 'rxjs';

@Injectable({
	providedIn: 'root'
})
export class ProposalTemplateService {
	API_URL = `${API_PREFIX}/employee-proposal-template`;

	constructor(private http: HttpClient) {}

	getAll(request: any = {}) {
		return firstValueFrom(
			this.http.get<IPagination<IEmployeeProposalTemplate>>(this.API_URL, {
				params: toParams(request)
			})
		);
	}

	create(request) {
		return firstValueFrom(this.http.post<IEmployeeProposalTemplate>(this.API_URL, request));
	}

	update(id, request: IEmployeeProposalTemplate) {
		return firstValueFrom(this.http.put<IEmployeeProposalTemplate>(`${this.API_URL}/${id}`, request));
	}

	makeDefault(id) {
		return firstValueFrom(this.http.post<IEmployeeProposalTemplate>(`${this.API_URL}/${id}/make-default`, {}));
	}

	delete(id: string) {
		return firstValueFrom(this.http.delete(`${this.API_URL}/${id}`));
	}
}
