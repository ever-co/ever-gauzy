import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { first } from 'rxjs/operators';
import {
	ICandidateTechnologies,
	ICandidateTechnologiesCreateInput,
	ICandidateTechnologiesFindInput
} from '@gauzy/contracts';
import { API_PREFIX } from '../constants/app.constants';

@Injectable()
export class CandidateTechnologiesService {
	constructor(private http: HttpClient) {}

	create(
		createInput: ICandidateTechnologiesCreateInput
	): Promise<ICandidateTechnologies> {
		return this.http
			.post<ICandidateTechnologies>(
				`${API_PREFIX}/candidate-technologies`,
				createInput
			)
			.pipe(first())
			.toPromise();
	}

	createBulk(
		interviewId: string,
		technologies: string[]
	): Promise<ICandidateTechnologies[]> {
		return this.http
			.post<ICandidateTechnologies[]>(
				`${API_PREFIX}/candidate-technologies/createBulk`,
				{ interviewId, technologies }
			)
			.pipe(first())
			.toPromise();
	}

	getAll(
		findInput?: ICandidateTechnologiesFindInput
	): Promise<{ items: any[]; total: number }> {
		const data = JSON.stringify({ findInput });

		return this.http
			.get<{ items: ICandidateTechnologies[]; total: number }>(
				`${API_PREFIX}/candidate-technologies`,
				{
					params: { data }
				}
			)
			.pipe(first())
			.toPromise();
	}

	update(id: string, updateInput: any): Promise<any> {
		return this.http
			.put(`${API_PREFIX}/candidate-technologies/${id}`, updateInput)
			.pipe(first())
			.toPromise();
	}
	updateBulk(technologies: ICandidateTechnologies[]): Promise<any> {
		return this.http
			.put(
				`${API_PREFIX}/candidate-technologies/updateBulk`,
				technologies
			)
			.pipe(first())
			.toPromise();
	}

	findByInterviewId(interviewId: string): Promise<ICandidateTechnologies[]> {
		return this.http
			.get<ICandidateTechnologies[]>(
				`${API_PREFIX}/candidate-technologies/getByInterviewId/${interviewId}`
			)
			.pipe(first())
			.toPromise();
	}

	delete(id: string): Promise<any> {
		return this.http
			.delete(`${API_PREFIX}/candidate-technologies/${id}`)
			.pipe(first())
			.toPromise();
	}

	deleteBulkByInterviewId(
		id: string,
		technologies?: ICandidateTechnologies[]
	): Promise<any> {
		const data = JSON.stringify({ technologies });
		return this.http
			.delete(`${API_PREFIX}/candidate-technologies/deleteBulk/${id}`, {
				params: { data }
			})
			.pipe(first())
			.toPromise();
	}
}
