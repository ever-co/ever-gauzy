import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import {
	ICandidateCreateInput,
	ICandidateFindInput,
	ICandidate,
	ICandidateUpdateInput,
	CandidateStatus
} from '@gauzy/contracts';
import { Observable } from 'rxjs';
import { firstValueFrom } from 'rxjs';
import { API_PREFIX } from '../constants/app.constants';

@Injectable()
export class CandidatesService {
	constructor(private http: HttpClient) { }

	getAll(
		relations?: string[],
		findInput?: ICandidateFindInput
	): Observable<{ items: ICandidate[]; total: number }> {
		const data = JSON.stringify({ relations, findInput });
		return this.http.get<{ items: ICandidate[]; total: number }>(
			`${API_PREFIX}/candidate`,
			{
				params: { data }
			}
		);
	}

	getCandidateById(
		id: string,
		relations?: string[],
		findInput?: ICandidateFindInput
	): Promise<ICandidate> {
		const data = JSON.stringify({ relations, findInput });
		return firstValueFrom(
			this.http
				.get<ICandidate>(`${API_PREFIX}/candidate/${id}`, {
					params: { data }
				})
		);
	}

	delete(id: string): Promise<ICandidate> {
		return firstValueFrom(
			this.http
				.delete<ICandidate>(`${API_PREFIX}/candidate/${id}`)
		);
	}

	update(id: string, updateInput: ICandidateUpdateInput): Promise<any> {
		return firstValueFrom(this.http
			.put(`${API_PREFIX}/candidate/${id}`, updateInput)
		);
	}

	create(createInput: ICandidateCreateInput): Observable<ICandidate> {
		return this.http.post<ICandidate>(
			`${API_PREFIX}/candidate`,
			createInput
		);
	}

	createBulk(createInput: ICandidateCreateInput[]): Observable<ICandidate[]> {
		return this.http.post<ICandidate[]>(
			`${API_PREFIX}/candidate/bulk`,
			createInput
		);
	}

	setCandidateAsArchived(id: string): Promise<ICandidate> {
		return firstValueFrom(
			this.http
				.put<ICandidate>(`${API_PREFIX}/candidate/${id}`, {
					isArchived: true
				})
		);
	}

	setCandidateAsHired(id: string): Promise<ICandidate> {
		return firstValueFrom(
			this.http
				.put<ICandidate>(`${API_PREFIX}/candidate/${id}`, {
					status: CandidateStatus.HIRED
				})
		);
	}

	setCandidateAsRejected(id: string): Promise<ICandidate> {
		return firstValueFrom(
			this.http
				.put<ICandidate>(`${API_PREFIX}/candidate/${id}`, {
					status: CandidateStatus.REJECTED
				})
		);
	}

	setCandidateAsApplied(id: string): Promise<ICandidate> {
		return firstValueFrom(
			this.http
				.put<ICandidate>(`${API_PREFIX}/candidate/${id}`, {
					status: CandidateStatus.APPLIED
				})
		);
	}
}
