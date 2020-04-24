import {
	ICandidateCvCreateInput,
	ICandidateCv,
	ICandidateCvFindInput
} from '../../../../../../libs/models/src/lib/candidate-cv.model';
import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { first } from 'rxjs/operators';

@Injectable({
	providedIn: 'root'
})
export class CandidateCvService {
	constructor(private http: HttpClient) {}

	create(createInput: ICandidateCvCreateInput): Promise<ICandidateCv> {
		return this.http
			.post<ICandidateCv>('/api/candidate_cv', createInput)
			.pipe(first())
			.toPromise();
	}

	getAll(
		relations?: string[],
		findInput?: ICandidateCvFindInput
	): Promise<{ items: any[]; total: number }> {
		const data = JSON.stringify({ relations, findInput });
		return this.http
			.get<{ items: ICandidateCv[]; total: number }>(
				`/api/candidate-cv`,
				{
					params: { data }
				}
			)
			.pipe(first())
			.toPromise();
	}

	update(id: string, updateInput: any): Promise<any> {
		return this.http
			.put(`/api/candidate-cv/${id}`, updateInput)
			.pipe(first())
			.toPromise();
	}

	delete(id: string): Promise<any> {
		return this.http
			.delete(`/api/candidate-cv/${id}`)
			.pipe(first())
			.toPromise();
	}
}
