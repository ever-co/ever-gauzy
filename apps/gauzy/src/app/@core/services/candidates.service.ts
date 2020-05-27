import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import {
	CandidateCreateInput as ICandidateCreateInput,
	CandidateFindInput,
	Candidate,
	CandidateUpdateInput,
	CandidateStatus,
} from '@gauzy/models';
import { Observable } from 'rxjs';
import { first } from 'rxjs/operators';

@Injectable()
export class CandidatesService {
	constructor(private http: HttpClient) {}

	getAll(
		relations?: string[],
		findInput?: CandidateFindInput
	): Observable<{ items: Candidate[]; total: number }> {
		const data = JSON.stringify({ relations, findInput });
		return this.http.get<{ items: Candidate[]; total: number }>(
			`/api/candidate`,
			{
				params: { data },
			}
		);
	}

	getCandidateById(id: string, relations?: string[]): Promise<Candidate> {
		const data = JSON.stringify({ relations });
		return this.http
			.get<Candidate>(`/api/candidate/${id}`, {
				params: { data },
			})
			.pipe(first())
			.toPromise();
	}

	delete(id: string): Promise<Candidate> {
		return this.http
			.delete<Candidate>(`/api/candidate/${id}`)
			.pipe(first())
			.toPromise();
	}
	update(id: string, updateInput: CandidateUpdateInput): Promise<any> {
		return this.http
			.put(`/api/candidate/${id}`, updateInput)
			.pipe(first())
			.toPromise();
	}

	create(createInput: ICandidateCreateInput): Observable<Candidate> {
		return this.http.post<Candidate>('/api/candidate/create', createInput);
	}

	createBulk(createInput: ICandidateCreateInput[]): Observable<Candidate[]> {
		return this.http.post<Candidate[]>(
			'/api/candidate/createBulk',
			createInput
		);
	}

	setCandidateAsArchived(id: string): Promise<Candidate> {
		return this.http
			.put<Candidate>(`/api/candidate/${id}`, { isArchived: true })
			.pipe(first())
			.toPromise();
	}

	setCandidateAsHired(id: string): Promise<Candidate> {
		return this.http
			.put<Candidate>(`/api/candidate/${id}`, {
				status: CandidateStatus.HIRED,
			})
			.pipe(first())
			.toPromise();
	}
	setCandidateAsRejected(id: string): Promise<Candidate> {
		return this.http
			.put<Candidate>(`/api/candidate/${id}`, {
				status: CandidateStatus.REJECTED,
			})
			.pipe(first())
			.toPromise();
	}
}
