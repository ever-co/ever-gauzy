import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { first } from 'rxjs/operators';
import {
	ICandidateFeedback,
	ICandidateFeedbackFindInput,
	ICandidateFeedbackCreateInput
} from '@gauzy/contracts';
import { API_PREFIX } from '../constants/app.constants';

@Injectable({
	providedIn: 'root'
})
export class CandidateFeedbacksService {
	constructor(private http: HttpClient) {}

	create(
		createInput: ICandidateFeedbackCreateInput
	): Promise<ICandidateFeedback> {
		return this.http
			.post<ICandidateFeedback>(
				`${API_PREFIX}/candidate-feedbacks`,
				createInput
			)
			.pipe(first())
			.toPromise();
	}

	getAll(
		relations?: string[],
		findInput?: ICandidateFeedbackFindInput
	): Promise<{ items: any[]; total: number }> {
		const data = JSON.stringify({ relations, findInput });
		return this.http
			.get<{ items: ICandidateFeedback[]; total: number }>(
				`${API_PREFIX}/candidate-feedbacks`,
				{
					params: { data }
				}
			)
			.pipe(first())
			.toPromise();
	}
	findById(id: string): Promise<ICandidateFeedback> {
		return this.http
			.get<ICandidateFeedback>(`${API_PREFIX}/candidate-feedbacks/${id}`)
			.pipe(first())
			.toPromise();
	}

	findByInterviewId(interviewId: string): Promise<ICandidateFeedback[]> {
		return this.http
			.get<ICandidateFeedback[]>(
				`${API_PREFIX}/candidate-feedbacks/interview/${interviewId}`
			)
			.pipe(first())
			.toPromise();
	}
	update(id: string, updateInput: any): Promise<any> {
		return this.http
			.put(`${API_PREFIX}/candidate-feedbacks/${id}`, updateInput)
			.pipe(first())
			.toPromise();
	}

	delete(feedbackId: string, interviewId?: string): Promise<any> {
		return this.http
			.delete(`${API_PREFIX}/candidate-feedbacks/interview/${interviewId}/${feedbackId}`)
			.pipe(first())
			.toPromise();
	}
}
