import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { first } from 'rxjs/operators';
import {
	IProposal,
	IProposalCreateInput,
	IProposalFindInput,
	IProposalViewModel
} from '@gauzy/contracts';
import { API_PREFIX } from '../constants/app.constants';

@Injectable()
export class ProposalsService {
	constructor(private http: HttpClient) {}

	create(createInput: IProposalCreateInput): Promise<any> {
		return this.http
			.post<IProposal>(`${API_PREFIX}/proposal/create`, createInput)
			.pipe(first())
			.toPromise();
	}

	update(id: string, updateInput: IProposalCreateInput): Promise<any> {
		return this.http
			.put(`${API_PREFIX}/proposal/${id}`, updateInput)
			.pipe(first())
			.toPromise();
	}

	delete(id: string): Promise<any> {
		return this.http
			.delete(`${API_PREFIX}/proposal/${id}`)
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
			.get<{ items: IProposal[]; total: number }>(
				`${API_PREFIX}/proposal`,
				{
					params: { data }
				}
			)
			.pipe(first())
			.toPromise();
	}

	getById(id: string, findInput?: IProposalFindInput, relations?: string[]) {
		const data = JSON.stringify({ relations, findInput });
		return this.http
			.get<IProposalViewModel>(`${API_PREFIX}/proposal/${id}`, {
				params: { data }
			})
			.pipe(first())
			.toPromise();
	}
}
