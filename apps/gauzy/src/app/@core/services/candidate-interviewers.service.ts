import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { first } from 'rxjs/operators';
import {
	ICandidateInterviewersFindInput,
	ICandidateInterviewersCreateInput,
	ICandidateInterviewers,
	ICandidateInterviewersDeleteInput
} from '@gauzy/models';

@Injectable()
export class CandidateInterviewersService {
	constructor(private http: HttpClient) {}

	create(
		createInput: ICandidateInterviewersCreateInput
	): Promise<ICandidateInterviewers> {
		return this.http
			.post<ICandidateInterviewers>(
				'/api/candidate-interviewers',
				createInput
			)
			.pipe(first())
			.toPromise();
	}

	getAll(
		findInput?: ICandidateInterviewersFindInput
	): Promise<{ items: any[]; total: number }> {
		const data = JSON.stringify({ findInput });
		return this.http
			.get<{ items: ICandidateInterviewers[]; total: number }>(
				`/api/candidate-interviewers`,
				{
					params: { data }
				}
			)
			.pipe(first())
			.toPromise();
	}

	update(id: string, updateInput: any): Promise<any> {
		return this.http
			.put(`/api/candidate-interviewers/${id}`, updateInput)
			.pipe(first())
			.toPromise();
	}

	delete(id: string): Promise<any> {
		return this.http
			.delete(`/api/candidate-interviewers/${id}`)
			.pipe(first())
			.toPromise();
	}
	findByInterviewId(interviewId: string): Promise<ICandidateInterviewers[]> {
		return this.http
			.get<ICandidateInterviewers[]>(
				`/api/candidate-interviewers/getByInterviewId/${interviewId}`
			)
			.pipe(first())
			.toPromise();
	}
	deleteBulkByInterviewId(id: string): Promise<any> {
		const data = JSON.stringify({ id });
		return this.http
			.delete('/api/candidate-interviewers/deleteBulkByInterviewId', {
				params: { data }
			})
			.pipe(first())
			.toPromise();
	}

	deleteBulkByEmployeeId(
		deleteInput: ICandidateInterviewersDeleteInput[]
	): Promise<any> {
		const data = JSON.stringify({ deleteInput });

		return this.http
			.delete('/api/candidate-interviewers/deleteBulkByEmployeeId', {
				params: { data }
			})
			.pipe(first())
			.toPromise();
	}
}
