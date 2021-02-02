import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { first } from 'rxjs/operators';
import {
	IEducationCreateInput,
	ICandidateEducation,
	IEducationFindInput
} from '@gauzy/contracts';
import { API_PREFIX } from '../constants/app.constants';

@Injectable({
	providedIn: 'root'
})
export class CandidateEducationsService {
	constructor(private http: HttpClient) {}

	create(createInput: IEducationCreateInput): Promise<ICandidateEducation> {
		return this.http
			.post<ICandidateEducation>(
				`${API_PREFIX}/candidate-educations`,
				createInput
			)
			.pipe(first())
			.toPromise();
	}

	getAll(
		findInput?: IEducationFindInput
	): Promise<{ items: any[]; total: number }> {
		const data = JSON.stringify({ findInput });
		return this.http
			.get<{ items: ICandidateEducation[]; total: number }>(
				`${API_PREFIX}/candidate-educations`,
				{
					params: { data }
				}
			)
			.pipe(first())
			.toPromise();
	}

	update(id: string, updateInput: any): Promise<any> {
		return this.http
			.put(`${API_PREFIX}/candidate-educations/${id}`, updateInput)
			.pipe(first())
			.toPromise();
	}

	delete(id: string): Promise<any> {
		return this.http
			.delete(`${API_PREFIX}/candidate-educations/${id}`)
			.pipe(first())
			.toPromise();
	}
}
