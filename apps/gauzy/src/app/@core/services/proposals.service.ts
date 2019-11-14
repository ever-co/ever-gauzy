import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { first } from 'rxjs/operators';
import {
	Proposal,
	ProposalCreateInput,
	ProposalFindInput
} from '@gauzy/models';

@Injectable()
export class ProposalsService {
	constructor(private http: HttpClient) {}

	create(createInput: ProposalCreateInput): Promise<Proposal> {
		return this.http
			.post<Proposal>('/api/proposal/create', createInput)
			.pipe(first())
			.toPromise();
	}

	getAll(
		relations?: string[],
		findInput?: ProposalFindInput,
		filterDate?: Date
	): Promise<{ items: Proposal[]; total: number }> {
		const data = JSON.stringify({ relations, findInput, filterDate });

		return this.http
			.get<{ items: Proposal[]; total: number }>(`/api/proposal`, {
				params: { data }
			})
			.pipe(first())
			.toPromise();
	}
}
