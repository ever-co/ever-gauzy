import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { first } from 'rxjs/operators';
import {
	ICandidateInterviewersFindInput,
	ICandidateInterviewersCreateInput,
	ICandidateInterviewers,
	ICandidateInterviewersDeleteInput
} from '@gauzy/contracts';
import { API_PREFIX } from '../constants/app.constants';

@Injectable()
export class CandidateInterviewersService {
	constructor(private http: HttpClient) {}

	create(
		createInput: ICandidateInterviewersCreateInput
	): Promise<ICandidateInterviewers> {
		return this.http
			.post<ICandidateInterviewers>(
				`${API_PREFIX}/candidate-interviewers`,
				createInput
			)
			.pipe(first())
			.toPromise();
	}

	createBulk(
		createInput: ICandidateInterviewersCreateInput
	): Promise<ICandidateInterviewers[]> {
		return this.http
			.post<ICandidateInterviewers[]>(
				`${API_PREFIX}/candidate-interviewers/createBulk`,
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
				`${API_PREFIX}/candidate-interviewers`,
				{
					params: { data }
				}
			)
			.pipe(first())
			.toPromise();
	}

	update(id: string, updateInput: any): Promise<any> {
		return this.http
			.put(`${API_PREFIX}/candidate-interviewers/${id}`, updateInput)
			.pipe(first())
			.toPromise();
	}

	delete(id: string): Promise<any> {
		return this.http
			.delete(`${API_PREFIX}/candidate-interviewers/${id}`)
			.pipe(first())
			.toPromise();
	}

	findByInterviewId(interviewId: string): Promise<ICandidateInterviewers[]> {
		return this.http
			.get<ICandidateInterviewers[]>(
				`${API_PREFIX}/candidate-interviewers/getByInterviewId/${interviewId}`
			)
			.pipe(first())
			.toPromise();
	}

	deleteBulkByInterviewId(id: string): Promise<any> {
		const data = JSON.stringify({ id });
		return this.http
			.delete(
				`${API_PREFIX}/candidate-interviewers/deleteBulkByInterviewId`,
				{
					params: { data }
				}
			)
			.pipe(first())
			.toPromise();
	}

	deleteBulkByEmployeeId(
		deleteInput: ICandidateInterviewersDeleteInput[]
	): Promise<any> {
		const data = JSON.stringify({ deleteInput });

		return this.http
			.delete(
				`${API_PREFIX}/candidate-interviewers/deleteBulkByEmployeeId`,
				{
					params: { data }
				}
			)
			.pipe(first())
			.toPromise();
	}
}
