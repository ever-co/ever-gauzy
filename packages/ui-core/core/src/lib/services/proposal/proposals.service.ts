import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { IPagination, IProposal, IProposalCreateInput, IProposalFindInput, IProposalViewModel } from '@gauzy/contracts';
import { toParams } from '@gauzy/ui-core/common';
import { API_PREFIX } from '@gauzy/ui-core/common';

@Injectable({
	providedIn: 'root'
})
export class ProposalsService {
	constructor(private readonly http: HttpClient) {}

	create(createInput: IProposalCreateInput): Promise<any> {
		return firstValueFrom(this.http.post<IProposal>(`${API_PREFIX}/proposal`, createInput));
	}

	update(id: string, updateInput: IProposalCreateInput): Promise<any> {
		return firstValueFrom(this.http.put(`${API_PREFIX}/proposal/${id}`, updateInput));
	}

	delete(id: string): Promise<any> {
		return firstValueFrom(this.http.delete(`${API_PREFIX}/proposal/${id}`));
	}

	getAll(relations: string[] = [], where?: IProposalFindInput): Promise<IPagination<IProposal>> {
		return firstValueFrom(
			this.http.get<IPagination<IProposal>>(`${API_PREFIX}/proposal`, {
				params: toParams({ where, relations })
			})
		);
	}

	getById(id: string, relations?: string[]) {
		return this.http.get<IProposalViewModel>(`${API_PREFIX}/proposal/${id}`, {
			params: toParams({ relations })
		});
	}
}
