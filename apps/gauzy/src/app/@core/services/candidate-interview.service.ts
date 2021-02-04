import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { first } from 'rxjs/operators';
import {
	ICandidateInterviewFindInput,
	ICandidateInterviewCreateInput,
	ICandidateInterview
} from '@gauzy/contracts';
import { API_PREFIX } from '../constants/app.constants';

@Injectable({
	providedIn: 'root'
})
export class CandidateInterviewService {
	constructor(private http: HttpClient) {}

	create(
		createInput: ICandidateInterviewCreateInput
	): Promise<ICandidateInterview> {
		return this.http
			.post<ICandidateInterview>(
				`${API_PREFIX}/candidate-interview`,
				createInput
			)
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
				`${API_PREFIX}/candidate-interview`,
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
			.get<ICandidateInterview>(
				`${API_PREFIX}/candidate-interview/${id}`,
				{
					params: { data }
				}
			)
			.pipe(first())
			.toPromise();
	}

	findByCandidateId(candidateId: string): Promise<ICandidateInterview[]> {
		return this.http
			.get<ICandidateInterview[]>(
				`${API_PREFIX}/candidate-interview/findByCandidateId/${candidateId}`
			)
			.pipe(first())
			.toPromise();
	}
	update(id: string, updateInput: any): Promise<any> {
		return this.http
			.put(`${API_PREFIX}/candidate-interview/${id}`, updateInput)
			.pipe(first())
			.toPromise();
	}

	setInterviewAsArchived(id: string): Promise<ICandidateInterview> {
		return this.http
			.put<ICandidateInterview>(
				`${API_PREFIX}/candidate-interview/${id}`,
				{
					isArchived: true
				}
			)
			.pipe(first())
			.toPromise();
	}
	delete(id: string): Promise<any> {
		return this.http
			.delete(`${API_PREFIX}/candidate-interview/${id}`)
			.pipe(first())
			.toPromise();
	}
}
