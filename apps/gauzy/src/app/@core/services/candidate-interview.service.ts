import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
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
	constructor(private http: HttpClient) { }

	create(
		createInput: ICandidateInterviewCreateInput
	): Promise<ICandidateInterview> {
		return firstValueFrom(
			this.http
				.post<ICandidateInterview>(
					`${API_PREFIX}/candidate-interview`,
					createInput
				)
		);
	}

	getAll(
		relations: string[],
		findInput?: ICandidateInterviewFindInput
	): Promise<{ items: any[]; total: number }> {
		const data = JSON.stringify({ relations, findInput });
		return firstValueFrom(this.http
			.get<{ items: ICandidateInterview[]; total: number }>(
				`${API_PREFIX}/candidate-interview`,
				{
					params: { data }
				}
			)
		);
	}

	findById(id: string, relations?: string[]): Promise<ICandidateInterview> {
		const data = JSON.stringify({ relations });
		return firstValueFrom(this.http
			.get<ICandidateInterview>(
				`${API_PREFIX}/candidate-interview/${id}`,
				{
					params: { data }
				}
			)
		);
	}

	findByCandidateId(candidateId: string): Promise<ICandidateInterview[]> {
		return firstValueFrom(this.http
			.get<ICandidateInterview[]>(
				`${API_PREFIX}/candidate-interview/candidate/${candidateId}`
			)
		);
	}
	update(id: string, updateInput: any): Promise<any> {
		return firstValueFrom(
			this.http
				.put(`${API_PREFIX}/candidate-interview/${id}`, updateInput)
		);
	}

	setInterviewAsArchived(id: string): Promise<ICandidateInterview> {
		return firstValueFrom(
			this.http
				.put<ICandidateInterview>(
					`${API_PREFIX}/candidate-interview/${id}`,
					{
						isArchived: true
					}
				)
		);
	}
	delete(id: string): Promise<any> {
		return firstValueFrom(this.http
			.delete(`${API_PREFIX}/candidate-interview/${id}`)
		);
	}
}
