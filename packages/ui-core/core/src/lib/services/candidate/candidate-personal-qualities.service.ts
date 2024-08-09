import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import {
	ICandidatePersonalQualities,
	ICandidatePersonalQualitiesCreateInput,
	ICandidatePersonalQualitiesFindInput
} from '@gauzy/contracts';
import { API_PREFIX } from '@gauzy/ui-core/common';

@Injectable()
export class CandidatePersonalQualitiesService {
	constructor(private http: HttpClient) {}

	create(createInput: ICandidatePersonalQualitiesCreateInput): Promise<ICandidatePersonalQualities> {
		return firstValueFrom(
			this.http.post<ICandidatePersonalQualities>(`${API_PREFIX}/candidate-personal-qualities`, createInput)
		);
	}

	createBulk(interviewId: string, personalQualities: string[]): Promise<ICandidatePersonalQualities[]> {
		return firstValueFrom(
			this.http.post<ICandidatePersonalQualities[]>(`${API_PREFIX}/candidate-personal-qualities/bulk`, {
				interviewId,
				personalQualities
			})
		);
	}

	getAll(findInput?: ICandidatePersonalQualitiesFindInput): Promise<{ items: any[]; total: number }> {
		const data = JSON.stringify({ findInput });

		return firstValueFrom(
			this.http.get<{ items: ICandidatePersonalQualities[]; total: number }>(
				`${API_PREFIX}/candidate-personal-qualities`,
				{
					params: { data }
				}
			)
		);
	}

	findByInterviewId(interviewId: string): Promise<ICandidatePersonalQualities[]> {
		return firstValueFrom(
			this.http.get<ICandidatePersonalQualities[]>(
				`${API_PREFIX}/candidate-personal-qualities/interview/${interviewId}`
			)
		);
	}

	update(id: string, updateInput: any): Promise<any> {
		return firstValueFrom(this.http.put(`${API_PREFIX}/candidate-personal-qualities/${id}`, updateInput));
	}

	delete(id: string): Promise<any> {
		return firstValueFrom(this.http.delete(`${API_PREFIX}/candidate-personal-qualities/${id}`));
	}

	deleteBulkByInterviewId(id: string, personalQualities?: ICandidatePersonalQualities[]): Promise<any> {
		const data = JSON.stringify({ personalQualities });
		return firstValueFrom(
			this.http.delete(`${API_PREFIX}/candidate-personal-qualities/bulk/${id}`, {
				params: { data }
			})
		);
	}
}
