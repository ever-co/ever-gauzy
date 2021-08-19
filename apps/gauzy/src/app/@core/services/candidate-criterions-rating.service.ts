import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { first } from 'rxjs/operators';
import {
	ICandidatePersonalQualities,
	ICandidateCriterionsRating,
	ICandidateTechnologies
} from '@gauzy/contracts';
import { API_PREFIX } from '../constants/app.constants';

@Injectable()
export class CandidateCriterionsRatingService {
	constructor(private http: HttpClient) {}

	createBulk(
		feedbackId: string,
		technologies: ICandidateTechnologies[],
		qualities: ICandidatePersonalQualities[]
	): Promise<ICandidateCriterionsRating[]> {
		return this.http
			.post<ICandidateCriterionsRating[]>(
				`${API_PREFIX}/candidate-criterions-rating/bulk`,
				{
					feedbackId,
					technologies,
					qualities
				}
			)
			.pipe(first())
			.toPromise();
	}

	getAll(): Promise<{ items: any[]; total: number }> {
		return this.http
			.get<{ items: ICandidateCriterionsRating[]; total: number }>(
				`${API_PREFIX}/candidate-criterions-rating`
			)
			.pipe(first())
			.toPromise();
	}
	updateBulk(
		criterionsRating: ICandidateCriterionsRating[],
		technologies: number[],
		personalQualities: number[]
	): Promise<any> {
		return this.http
			.put(`${API_PREFIX}/candidate-criterions-rating/bulk`, {
				criterionsRating,
				technologies,
				personalQualities
			})
			.pipe(first())
			.toPromise();
	}

	deleteBulkByFeedbackId(id: string): Promise<any> {
		return this.http
			.delete(`${API_PREFIX}/candidate-criterions-rating/feedback/${id}`)
			.pipe(first())
			.toPromise();
	}
}
