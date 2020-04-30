import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { first } from 'rxjs/operators';
import {
	ICandidateFeedback,
	ICandidateFeedbackFindInput,
	ICandidateFeedbackCreateInput
} from '@gauzy/models';

@Injectable({
	providedIn: 'root'
})
export class CandidateFeedbacksService {
	constructor(private http: HttpClient) {}

	create(
		createInput: ICandidateFeedbackCreateInput
	): Promise<ICandidateFeedback> {
		return this.http
			.post<ICandidateFeedback>('/api/candidate-feedbacks', createInput)
			.pipe(first())
			.toPromise();
	}

	getAll(
		findInput?: ICandidateFeedbackFindInput
	): Promise<{ items: any[]; total: number }> {
		const data = JSON.stringify({ findInput });
		return this.http
			.get<{ items: ICandidateFeedback[]; total: number }>(
				`/api/candidate-feedbacks`,
				{
					params: { data }
				}
			)
			.pipe(first())
			.toPromise();
	}

	update(id: string, updateInput: any): Promise<any> {
		return this.http
			.put(`/api/candidate-feedbacks/${id}`, updateInput)
			.pipe(first())
			.toPromise();
	}

	delete(id: string): Promise<any> {
		return this.http
			.delete(`/api/candidate-feedbacks/${id}`)
			.pipe(first())
			.toPromise();
	}
}
