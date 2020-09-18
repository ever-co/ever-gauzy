import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { first } from 'rxjs/operators';
import {
	IProposal,
	IProposalCreateInput,
	IProposalFindInput
} from '@gauzy/models';

@Injectable()
export class ProposalsService {
	constructor(private http: HttpClient) {}

	create(createInput: IProposalCreateInput): Promise<any> {
		return this.http
			.post<IProposal>('/api/proposal/create', createInput)
			.pipe(first())
			.toPromise();
	}

	update(id: string, updateInput: IProposalCreateInput): Promise<any> {
		return this.http
			.put(`/api/proposal/${id}`, updateInput)
			.pipe(first())
			.toPromise();
	}

	delete(id: string): Promise<any> {
		return this.http
			.delete(`/api/proposal/${id}`)
			.pipe(first())
			.toPromise();
	}

	getAll(
		relations?: string[],
		findInput?: IProposalFindInput,
		filterDate?: Date
	): Promise<{ items: IProposal[]; total: number }> {
		const data = JSON.stringify({ relations, findInput, filterDate });

		return this.http
			.get<{ items: IProposal[]; total: number }>(`/api/proposal`, {
				params: { data }
			})
			.pipe(first())
			.toPromise();
	}
}
