import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { first } from 'rxjs/operators';
import {
	ICandidatePersonalQualities,
	ICandidatePersonalQualitiesCreateInput,
	ICandidatePersonalQualitiesFindInput
} from '@gauzy/contracts';
import { API_PREFIX } from '../constants/app.constants';

@Injectable()
export class CandidatePersonalQualitiesService {
	constructor(private http: HttpClient) {}

	create(
		createInput: ICandidatePersonalQualitiesCreateInput
	): Promise<ICandidatePersonalQualities> {
		return this.http
			.post<ICandidatePersonalQualities>(
				`${API_PREFIX}/candidate-personal-qualities`,
				createInput
			)
			.pipe(first())
			.toPromise();
	}

	createBulk(
		interviewId: string,
		personalQualities: string[]
	): Promise<ICandidatePersonalQualities[]> {
		return this.http
			.post<ICandidatePersonalQualities[]>(
				`${API_PREFIX}/candidate-personal-qualities/createBulk`,
				{ interviewId, personalQualities }
			)
			.pipe(first())
			.toPromise();
	}

	getAll(
		findInput?: ICandidatePersonalQualitiesFindInput
	): Promise<{ items: any[]; total: number }> {
		const data = JSON.stringify({ findInput });

		return this.http
			.get<{ items: ICandidatePersonalQualities[]; total: number }>(
				`${API_PREFIX}/candidate-personal-qualities`,
				{
					params: { data }
				}
			)
			.pipe(first())
			.toPromise();
	}

	findByInterviewId(
		interviewId: string
	): Promise<ICandidatePersonalQualities[]> {
		return this.http
			.get<ICandidatePersonalQualities[]>(
				`${API_PREFIX}/candidate-personal-qualities/getByInterviewId/${interviewId}`
			)
			.pipe(first())
			.toPromise();
	}

	update(id: string, updateInput: any): Promise<any> {
		return this.http
			.put(
				`${API_PREFIX}/candidate-personal-qualities/${id}`,
				updateInput
			)
			.pipe(first())
			.toPromise();
	}

	delete(id: string): Promise<any> {
		return this.http
			.delete(`${API_PREFIX}/candidate-personal-qualities/${id}`)
			.pipe(first())
			.toPromise();
	}

	deleteBulkByInterviewId(
		id: string,
		personalQualities?: ICandidatePersonalQualities[]
	): Promise<any> {
		const data = JSON.stringify({ personalQualities });
		return this.http
			.delete(
				`${API_PREFIX}/candidate-personal-qualities/deleteBulk/${id}`,
				{
					params: { data }
				}
			)
			.pipe(first())
			.toPromise();
	}
}
