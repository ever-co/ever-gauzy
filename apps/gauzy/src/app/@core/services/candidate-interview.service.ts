import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { first } from 'rxjs/operators';
import {
	ICandidateInterviewFindInput,
	ICandidateInterviewCreateInput,
	ICandidateInterview
} from '@gauzy/models';

@Injectable({
	providedIn: 'root'
})
export class CandidateInterviewService {
	constructor(private http: HttpClient) {}

	create(
		createInput: ICandidateInterviewCreateInput
	): Promise<ICandidateInterview> {
		return this.http
			.post<ICandidateInterview>('/api/candidate-interview', createInput)
			.pipe(first())
			.toPromise();
	}

	getAll(
		relations: string[],
		findInput?: ICandidateInterviewFindInput
	): Promise<{ items: any[]; total: number }> {
		const data = JSON.stringify({ relations, findInput });
		return this.http
			.get<{ items: ICandidateInterview[]; total: number }>(
				`/api/candidate-interview`,
				{
					params: { data }
				}
			)
			.pipe(first())
			.toPromise();
	}

	findById(id: string, relations?: string[]): Promise<ICandidateInterview> {
		const data = JSON.stringify({ relations });
		return this.http
			.get<ICandidateInterview>(`/api/candidate-interview/${id}`, {
				params: { data }
			})
			.pipe(first())
			.toPromise();
	}

	findByCandidateId(candidateId: string): Promise<ICandidateInterview[]> {
		return this.http
			.get<ICandidateInterview[]>(
				`/api/candidate-interview/findByCandidateId/${candidateId}`
			)
			.pipe(first())
			.toPromise();
	}
	update(id: string, updateInput: any): Promise<any> {
		return this.http
			.put(`/api/candidate-interview/${id}`, updateInput)
			.pipe(first())
			.toPromise();
	}

	delete(id: string): Promise<any> {
		return this.http
			.delete(`/api/candidate-interview/${id}`)
			.pipe(first())
			.toPromise();
	}
}
