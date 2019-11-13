import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { first } from 'rxjs/operators';
import { Proposal, ProposalCreateInput } from '@gauzy/models';

@Injectable()
export class ProposalsService {
	constructor(private http: HttpClient) {}

	create(createInput: ProposalCreateInput): Promise<Proposal> {
		return this.http
			.post<Proposal>('/api/proposal/create', createInput)
			.pipe(first())
			.toPromise();
	}
}
