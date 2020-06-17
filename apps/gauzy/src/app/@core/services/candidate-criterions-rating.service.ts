import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { first } from 'rxjs/operators';
import {
	ICandidatePersonalQualities,
	ICandidateCriterionsRating,
	ICandidateTechnologies
} from '@gauzy/models';

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
				'/api/candidate-criterions-rating/createBulk',
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
				`/api/candidate-criterions-rating`
			)
			.pipe(first())
			.toPromise();
	}
}
