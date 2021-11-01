import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
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
		return firstValueFrom(
			this.http
			.post<IProposal>(`${API_PREFIX}/proposal`, createInput)
		);
	}

	update(id: string, updateInput: IProposalCreateInput): Promise<any> {
		return firstValueFrom(
			this.http
			.put(`${API_PREFIX}/proposal/${id}`, updateInput)
		);
	}

	delete(id: string): Promise<any> {
		return firstValueFrom(
			this.http
			.delete(`${API_PREFIX}/proposal/${id}`)
		);
	}

	getAll(
		relations?: string[],
		findInput?: IProposalFindInput,
		filterDate?: Date
	): Promise<{ items: IProposal[]; total: number }> {
		const data = JSON.stringify({ relations, findInput, filterDate });

		return firstValueFrom(
			this.http
			.get<{ items: IProposal[]; total: number }>(
				`${API_PREFIX}/proposal`,
				{
					params: { data }
				}
			)
		);
	}

	getById(id: string, findInput?: IProposalFindInput, relations?: string[]) {
		const data = JSON.stringify({ relations, findInput });
		return firstValueFrom(
			this.http
			.get<IProposalViewModel>(`${API_PREFIX}/proposal/${id}`, {
				params: { data }
			})
		);
	}
}
