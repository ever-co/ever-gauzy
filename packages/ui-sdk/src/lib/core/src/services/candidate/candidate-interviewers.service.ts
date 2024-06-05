import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import {
	ICandidateInterviewersFindInput,
	ICandidateInterviewersCreateInput,
	ICandidateInterviewers,
	ICandidateInterviewersDeleteInput
} from '@gauzy/contracts';
import { API_PREFIX } from '@gauzy/ui-sdk/common';

@Injectable()
export class CandidateInterviewersService {
	constructor(private http: HttpClient) {}

	create(createInput: ICandidateInterviewersCreateInput): Promise<ICandidateInterviewers> {
		return firstValueFrom(
			this.http.post<ICandidateInterviewers>(`${API_PREFIX}/candidate-interviewers`, createInput)
		);
	}

	createBulk(createInput: ICandidateInterviewersCreateInput): Promise<ICandidateInterviewers[]> {
		return firstValueFrom(
			this.http.post<ICandidateInterviewers[]>(`${API_PREFIX}/candidate-interviewers/bulk`, createInput)
		);
	}

	getAll(findInput?: ICandidateInterviewersFindInput): Promise<{ items: any[]; total: number }> {
		const data = JSON.stringify({ findInput });
		return firstValueFrom(
			this.http.get<{ items: ICandidateInterviewers[]; total: number }>(`${API_PREFIX}/candidate-interviewers`, {
				params: { data }
			})
		);
	}

	update(id: string, updateInput: any): Promise<any> {
		return firstValueFrom(this.http.put(`${API_PREFIX}/candidate-interviewers/${id}`, updateInput));
	}

	delete(id: string): Promise<any> {
		return firstValueFrom(this.http.delete(`${API_PREFIX}/candidate-interviewers/${id}`));
	}

	findByInterviewId(interviewId: string): Promise<ICandidateInterviewers[]> {
		return firstValueFrom(
			this.http.get<ICandidateInterviewers[]>(`${API_PREFIX}/candidate-interviewers/interview/${interviewId}`)
		);
	}

	deleteBulkByInterviewId(interviewId: string): Promise<any> {
		return firstValueFrom(this.http.delete(`${API_PREFIX}/candidate-interviewers/interview/${interviewId}`));
	}

	deleteBulkByEmployeeId(deleteInput: ICandidateInterviewersDeleteInput[]): Promise<any> {
		const data = JSON.stringify({ deleteInput });

		return firstValueFrom(
			this.http.delete(`${API_PREFIX}/candidate-interviewers/deleteBulkByEmployeeId`, {
				params: { data }
			})
		);
	}
}
