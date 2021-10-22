import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import {
	ICandidatePersonalQualities,
	ICandidateCriterionsRating,
	ICandidateTechnologies
} from '@gauzy/contracts';
import { API_PREFIX } from '../constants/app.constants';

@Injectable()
export class CandidateCriterionsRatingService {
	constructor(private http: HttpClient) { }

	createBulk(
		feedbackId: string,
		technologies: ICandidateTechnologies[],
		qualities: ICandidatePersonalQualities[]
	): Promise<ICandidateCriterionsRating[]> {
		return firstValueFrom(
			this.http
				.post<ICandidateCriterionsRating[]>(
					`${API_PREFIX}/candidate-criterions-rating/bulk`,
					{
						feedbackId,
						technologies,
						qualities
					}
				)
		);
	}

	getAll(): Promise<{ items: any[]; total: number }> {
		return firstValueFrom(
			this.http
				.get<{ items: ICandidateCriterionsRating[]; total: number }>(
					`${API_PREFIX}/candidate-criterions-rating`
				)
		);
	}
	updateBulk(
		criterionsRating: ICandidateCriterionsRating[],
		technologies: number[],
		personalQualities: number[]
	): Promise<any> {
		return firstValueFrom(
			this.http
				.put(`${API_PREFIX}/candidate-criterions-rating/bulk`, {
					criterionsRating,
					technologies,
					personalQualities
				})
		);
	}

	deleteBulkByFeedbackId(id: string): Promise<any> {
		return firstValueFrom(
			this.http
				.delete(`${API_PREFIX}/candidate-criterions-rating/feedback/${id}`)
		);
	}
}
