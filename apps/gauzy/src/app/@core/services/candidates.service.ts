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
import { first } from 'rxjs/operators';
import { API_PREFIX } from '../constants/app.constants';

@Injectable()
export class CandidatesService {
	constructor(private http: HttpClient) {}

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
		return this.http
			.get<ICandidate>(`${API_PREFIX}/candidate/${id}`, {
				params: { data }
			})
			.pipe(first())
			.toPromise();
	}

	delete(id: string): Promise<ICandidate> {
		return this.http
			.delete<ICandidate>(`${API_PREFIX}/candidate/${id}`)
			.pipe(first())
			.toPromise();
	}

	update(id: string, updateInput: ICandidateUpdateInput): Promise<any> {
		return this.http
			.put(`${API_PREFIX}/candidate/${id}`, updateInput)
			.pipe(first())
			.toPromise();
	}

	create(createInput: ICandidateCreateInput): Observable<ICandidate> {
		return this.http.post<ICandidate>(
			`${API_PREFIX}/candidate/create`,
			createInput
		);
	}

	createBulk(createInput: ICandidateCreateInput[]): Observable<ICandidate[]> {
		return this.http.post<ICandidate[]>(
			`${API_PREFIX}/candidate/createBulk`,
			createInput
		);
	}

	setCandidateAsArchived(id: string): Promise<ICandidate> {
		return this.http
			.put<ICandidate>(`${API_PREFIX}/candidate/${id}`, {
				isArchived: true
			})
			.pipe(first())
			.toPromise();
	}

	setCandidateAsHired(id: string): Promise<ICandidate> {
		return this.http
			.put<ICandidate>(`${API_PREFIX}/candidate/${id}`, {
				status: CandidateStatus.HIRED
			})
			.pipe(first())
			.toPromise();
	}

	setCandidateAsRejected(id: string): Promise<ICandidate> {
		return this.http
			.put<ICandidate>(`${API_PREFIX}/candidate/${id}`, {
				status: CandidateStatus.REJECTED
			})
			.pipe(first())
			.toPromise();
	}

	setCandidateAsApplied(id: string): Promise<ICandidate> {
		return this.http
			.put<ICandidate>(`${API_PREFIX}/candidate/${id}`, {
				status: CandidateStatus.APPLIED
			})
			.pipe(first())
			.toPromise();
	}
}
