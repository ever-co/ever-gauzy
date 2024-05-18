import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { ICandidateFeedback, ICandidateFeedbackFindInput, ICandidateFeedbackCreateInput } from '@gauzy/contracts';
import { API_PREFIX } from '@gauzy/ui-sdk/common';

@Injectable({
	providedIn: 'root'
})
export class CandidateFeedbacksService {
	constructor(private http: HttpClient) {}

	create(createInput: ICandidateFeedbackCreateInput): Promise<ICandidateFeedback> {
		return firstValueFrom(this.http.post<ICandidateFeedback>(`${API_PREFIX}/candidate-feedbacks`, createInput));
	}

	getAll(relations?: string[], findInput?: ICandidateFeedbackFindInput): Promise<{ items: any[]; total: number }> {
		const data = JSON.stringify({ relations, findInput });
		return firstValueFrom(
			this.http.get<{ items: ICandidateFeedback[]; total: number }>(`${API_PREFIX}/candidate-feedbacks`, {
				params: { data }
			})
		);
	}
	findById(id: string): Promise<ICandidateFeedback> {
		return firstValueFrom(this.http.get<ICandidateFeedback>(`${API_PREFIX}/candidate-feedbacks/${id}`));
	}

	findByInterviewId(interviewId: string): Promise<ICandidateFeedback[]> {
		return firstValueFrom(
			this.http.get<ICandidateFeedback[]>(`${API_PREFIX}/candidate-feedbacks/interview/${interviewId}`)
		);
	}
	update(id: string, updateInput: any): Promise<any> {
		return firstValueFrom(this.http.put(`${API_PREFIX}/candidate-feedbacks/${id}`, updateInput));
	}

	delete(feedbackId: string, interviewId?: string): Promise<any> {
		return firstValueFrom(
			this.http.delete(`${API_PREFIX}/candidate-feedbacks/interview/${interviewId}/${feedbackId}`)
		);
	}
}
