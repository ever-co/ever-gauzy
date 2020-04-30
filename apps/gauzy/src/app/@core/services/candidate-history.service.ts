import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { first } from 'rxjs/operators';
import {
	ICandidateHistory,
	ICandidateHistoryFindInput,
	ICandidateHistoryCreateInput
} from '@gauzy/models';

@Injectable({
	providedIn: 'root'
})
export class CandidateHistoryService {
	constructor(private http: HttpClient) {}

	create(
		createInput: ICandidateHistoryCreateInput
	): Promise<ICandidateHistory> {
		return this.http
			.post<ICandidateHistory>('/api/candidate-history', createInput)
			.pipe(first())
			.toPromise();
	}

	getAll(
		findInput?: ICandidateHistoryFindInput
	): Promise<{ items: any[]; total: number }> {
		const data = JSON.stringify({ findInput });
		return this.http
			.get<{ items: ICandidateHistory[]; total: number }>(
				`/api/candidate-history`,
				{
					params: { data }
				}
			)
			.pipe(first())
			.toPromise();
	}

	update(id: string, updateInput: any): Promise<any> {
		return this.http
			.put(`/api/candidate-history/${id}`, updateInput)
			.pipe(first())
			.toPromise();
	}

	delete(id: string): Promise<any> {
		return this.http
			.delete(`/api/candidate-history/${id}`)
			.pipe(first())
			.toPromise();
	}
}
