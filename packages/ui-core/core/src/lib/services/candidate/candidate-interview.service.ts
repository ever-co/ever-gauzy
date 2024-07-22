import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, firstValueFrom } from 'rxjs';
import {
	ICandidateInterviewFindInput,
	ICandidateInterviewCreateInput,
	ICandidateInterview,
	IPagination,
	ICandidate
} from '@gauzy/contracts';
import { toParams } from '@gauzy/ui-core/common';
import { API_PREFIX } from '@gauzy/ui-core/common';

@Injectable({
	providedIn: 'root'
})
export class CandidateInterviewService {
	constructor(private readonly http: HttpClient) {}

	create(input: ICandidateInterviewCreateInput): Promise<ICandidateInterview> {
		return firstValueFrom(this.http.post<ICandidateInterview>(`${API_PREFIX}/candidate-interview`, input));
	}

	getAll(
		relations: string[] = [],
		where?: ICandidateInterviewFindInput
	): Observable<IPagination<ICandidateInterview>> {
		return this.http.get<IPagination<ICandidateInterview>>(`${API_PREFIX}/candidate-interview`, {
			params: toParams({ where, relations })
		});
	}

	findById(id: ICandidateInterview['id'], relations: string[] = []): Promise<ICandidateInterview> {
		return firstValueFrom(
			this.http.get<ICandidateInterview>(`${API_PREFIX}/candidate-interview/${id}`, {
				params: toParams({ relations })
			})
		);
	}

	findByCandidateId(candidateId: ICandidate['id']): Promise<ICandidateInterview[]> {
		return firstValueFrom(
			this.http.get<ICandidateInterview[]>(`${API_PREFIX}/candidate-interview/candidate/${candidateId}`)
		);
	}

	update(id: ICandidateInterview['id'], input: ICandidateInterviewCreateInput): Promise<ICandidateInterview> {
		return firstValueFrom(this.http.put<ICandidateInterview>(`${API_PREFIX}/candidate-interview/${id}`, input));
	}

	setInterviewAsArchived(id: ICandidateInterview['id']): Promise<ICandidateInterview> {
		return firstValueFrom(
			this.http.put<ICandidateInterview>(`${API_PREFIX}/candidate-interview/${id}`, {
				isArchived: true
			})
		);
	}

	delete(id: ICandidateInterview['id']): Promise<any> {
		return firstValueFrom(this.http.delete(`${API_PREFIX}/candidate-interview/${id}`));
	}
}
