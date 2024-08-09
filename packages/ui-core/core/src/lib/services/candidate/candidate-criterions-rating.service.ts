import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import {
	ICandidatePersonalQualities,
	ICandidateCriterionsRating,
	ICandidateTechnologies,
	IPagination
} from '@gauzy/contracts';
import { API_PREFIX } from '@gauzy/ui-core/common';

@Injectable()
export class CandidateCriterionsRatingService {
	constructor(private http: HttpClient) {}

	createBulk(
		feedbackId: string,
		technologies: ICandidateTechnologies[],
		qualities: ICandidatePersonalQualities[]
	): Promise<ICandidateCriterionsRating[]> {
		return firstValueFrom(
			this.http.post<ICandidateCriterionsRating[]>(`${API_PREFIX}/candidate-criterions-rating/bulk`, {
				feedbackId,
				technologies,
				qualities
			})
		);
	}

	getAll(): Promise<IPagination<ICandidateCriterionsRating>> {
		return firstValueFrom(
			this.http.get<IPagination<ICandidateCriterionsRating>>(`${API_PREFIX}/candidate-criterions-rating`)
		);
	}

	updateBulk(
		criterionsRating: ICandidateCriterionsRating[],
		technologies: number[],
		personalQualities: number[]
	): Promise<any> {
		return firstValueFrom(
			this.http.put(`${API_PREFIX}/candidate-criterions-rating/bulk`, {
				criterionsRating,
				technologies,
				personalQualities
			})
		);
	}

	deleteBulkByFeedbackId(id: string): Promise<any> {
		return firstValueFrom(this.http.delete(`${API_PREFIX}/candidate-criterions-rating/feedback/${id}`));
	}
}
