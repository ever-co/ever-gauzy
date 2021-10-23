import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
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
	constructor(private http: HttpClient) { }

	create(createInput: IEducationCreateInput): Promise<ICandidateEducation> {
		return firstValueFrom(
			this.http
				.post<ICandidateEducation>(
					`${API_PREFIX}/candidate-educations`,
					createInput
				)
		);
	}

	getAll(
		findInput?: IEducationFindInput
	): Promise<{ items: any[]; total: number }> {
		const data = JSON.stringify({ findInput });
		return firstValueFrom(
			this.http
				.get<{ items: ICandidateEducation[]; total: number }>(
					`${API_PREFIX}/candidate-educations`,
					{
						params: { data }
					}
				)
		);
	}

	update(id: string, updateInput: any): Promise<any> {
		return firstValueFrom(
			this.http
				.put(`${API_PREFIX}/candidate-educations/${id}`, updateInput)
		);
	}

	delete(id: string): Promise<any> {
		return firstValueFrom(
			this.http
				.delete(`${API_PREFIX}/candidate-educations/${id}`)
		);
	}
}
