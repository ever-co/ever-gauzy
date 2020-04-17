import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { first } from 'rxjs/operators';
import {
	IEducationCreateInput,
	Education,
	IEducationFindInput
} from 'libs/models/src/lib/candidate-education.model';

@Injectable({
	providedIn: 'root'
})
export class CandidateEducationsService {
	constructor(private http: HttpClient) {}

	create(createInput: IEducationCreateInput): Promise<Education> {
		return this.http
			.post<Education>('/api/candidate-educations', createInput)
			.pipe(first())
			.toPromise();
	}

	getAll(
		findInput?: IEducationFindInput
	): Promise<{ items: any[]; total: number }> {
		const data = JSON.stringify({ findInput });
		return this.http
			.get<{ items: Education[]; total: number }>(
				`/api/candidate-educations`,
				{
					params: { data }
				}
			)
			.pipe(first())
			.toPromise();
	}

	update(id: string, updateInput: any): Promise<any> {
		return this.http
			.put(`/api/candidate-educations/${id}`, updateInput)
			.pipe(first())
			.toPromise();
	}

	delete(id: string): Promise<any> {
		return this.http
			.delete(`/api/candidate-educations/${id}`)
			.pipe(first())
			.toPromise();
	}
}
