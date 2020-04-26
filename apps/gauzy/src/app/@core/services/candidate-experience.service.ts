import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { first } from 'rxjs/operators';
import {
	IExperience,
	IExperienceCreateInput,
	IExperienceFindInput
} from '@gauzy/models';

@Injectable({
	providedIn: 'root'
})
export class CandidateExperienceService {
	constructor(private http: HttpClient) {}

	create(createInput: IExperienceCreateInput): Promise<IExperience> {
		return this.http
			.post<IExperience>('/api/candidate-experience', createInput)
			.pipe(first())
			.toPromise();
	}

	getAll(
		findInput?: IExperienceFindInput
	): Promise<{ items: any[]; total: number }> {
		const data = JSON.stringify({ findInput });
		return this.http
			.get<{ items: IExperience[]; total: number }>(
				`/api/candidate-experience`,
				{
					params: { data }
				}
			)
			.pipe(first())
			.toPromise();
	}

	update(id: string, updateInput: any): Promise<any> {
		return this.http
			.put(`/api/candidate-experience/${id}`, updateInput)
			.pipe(first())
			.toPromise();
	}

	delete(id: string): Promise<any> {
		return this.http
			.delete(`/api/candidate-experience/${id}`)
			.pipe(first())
			.toPromise();
	}
}
