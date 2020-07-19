import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { first } from 'rxjs/operators';
import {
	ICandidatePersonalQualities,
	ICandidatePersonalQualitiesCreateInput
} from '@gauzy/models';

@Injectable()
export class CandidatePersonalQualitiesService {
	constructor(private http: HttpClient) {}

	create(
		createInput: ICandidatePersonalQualitiesCreateInput
	): Promise<ICandidatePersonalQualities> {
		return this.http
			.post<ICandidatePersonalQualities>(
				'/api/candidate-personal-qualities',
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
				'/api/candidate-personal-qualities/createBulk',
				{ interviewId, personalQualities }
			)
			.pipe(first())
			.toPromise();
	}

	getAll(): Promise<{ items: any[]; total: number }> {
		return this.http
			.get<{ items: ICandidatePersonalQualities[]; total: number }>(
				`/api/candidate-personal-qualities`
			)
			.pipe(first())
			.toPromise();
	}

	findByInterviewId(
		interviewId: string
	): Promise<ICandidatePersonalQualities[]> {
		return this.http
			.get<ICandidatePersonalQualities[]>(
				`/api/candidate-personal-qualities/getByInterviewId/${interviewId}`
			)
			.pipe(first())
			.toPromise();
	}

	update(id: string, updateInput: any): Promise<any> {
		return this.http
			.put(`/api/candidate-personal-qualities/${id}`, updateInput)
			.pipe(first())
			.toPromise();
	}

	delete(id: string): Promise<any> {
		return this.http
			.delete(`/api/candidate-personal-qualities/${id}`)
			.pipe(first())
			.toPromise();
	}

	deleteBulkByInterviewId(
		id: string,
		personalQualities?: ICandidatePersonalQualities[]
	): Promise<any> {
		const data = JSON.stringify({ personalQualities });
		return this.http
			.delete(`/api/candidate-personal-qualities/deleteBulk/${id}`, {
				params: { data }
			})
			.pipe(first())
			.toPromise();
	}
}
