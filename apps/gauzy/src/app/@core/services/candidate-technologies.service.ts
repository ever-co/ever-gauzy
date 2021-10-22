import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import {
	ICandidateTechnologies,
	ICandidateTechnologiesCreateInput,
	ICandidateTechnologiesFindInput
} from '@gauzy/contracts';
import { API_PREFIX } from '../constants/app.constants';

@Injectable()
export class CandidateTechnologiesService {
	constructor(private http: HttpClient) { }

	create(
		createInput: ICandidateTechnologiesCreateInput
	): Promise<ICandidateTechnologies> {
		return firstValueFrom(
			this.http
				.post<ICandidateTechnologies>(
					`${API_PREFIX}/candidate-technologies`,
					createInput
				)
		);
	}

	createBulk(
		interviewId: string,
		technologies: string[]
	): Promise<ICandidateTechnologies[]> {
		return firstValueFrom(
			this.http
				.post<ICandidateTechnologies[]>(
					`${API_PREFIX}/candidate-technologies/bulk`,
					{ interviewId, technologies }
				)
		);
	}

	getAll(
		findInput?: ICandidateTechnologiesFindInput
	): Promise<{ items: any[]; total: number }> {
		const data = JSON.stringify({ findInput });

		return firstValueFrom(
			this.http
				.get<{ items: ICandidateTechnologies[]; total: number }>(
					`${API_PREFIX}/candidate-technologies`,
					{
						params: { data }
					}
				)
		);
	}

	update(id: string, updateInput: any): Promise<any> {
		return firstValueFrom(
			this.http
				.put(`${API_PREFIX}/candidate-technologies/${id}`, updateInput)
		);
	}
	updateBulk(technologies: ICandidateTechnologies[]): Promise<any> {
		return firstValueFrom(
			this.http
				.put(
					`${API_PREFIX}/candidate-technologies/bulk`,
					technologies
				)
		);
	}

	findByInterviewId(interviewId: string): Promise<ICandidateTechnologies[]> {
		return firstValueFrom(
			this.http
				.get<ICandidateTechnologies[]>(
					`${API_PREFIX}/candidate-technologies/interview/${interviewId}`
				)
		);
	}

	delete(id: string): Promise<any> {
		return firstValueFrom(
			this.http
				.delete(`${API_PREFIX}/candidate-technologies/${id}`)
		);
	}

	deleteBulkByInterviewId(
		id: string,
		technologies?: ICandidateTechnologies[]
	): Promise<any> {
		const data = JSON.stringify({ technologies });
		return firstValueFrom(
			this.http
				.delete(`${API_PREFIX}/candidate-technologies/bulk/${id}`, {
					params: { data }
				})
		);
	}
}
