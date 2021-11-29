import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import {
	ICandidateExperience,
	IExperienceCreateInput,
	IExperienceFindInput
} from '@gauzy/contracts';
import { API_PREFIX } from '../constants/app.constants';

@Injectable({
	providedIn: 'root'
})
export class CandidateExperienceService {
	constructor(private http: HttpClient) { }

	create(createInput: IExperienceCreateInput): Promise<ICandidateExperience> {
		return firstValueFrom(
			this.http
				.post<ICandidateExperience>(
					`${API_PREFIX}/candidate-experience`,
					createInput
				)
		);
	}

	getAll(
		findInput?: IExperienceFindInput,
		relations?: string[]
	): Promise<{ items: any[]; total: number }> {
		const data = JSON.stringify({ findInput, relations });
		return firstValueFrom(
			this.http
				.get<{ items: ICandidateExperience[]; total: number }>(
					`${API_PREFIX}/candidate-experience`,
					{
						params: { data }
					}
				)
		);
	}

	update(id: string, updateInput: any): Promise<any> {
		return firstValueFrom(
			this.http
				.put(`${API_PREFIX}/candidate-experience/${id}`, updateInput)
		);
	}

	delete(id: string): Promise<any> {
		return firstValueFrom(
			this.http
				.delete(`${API_PREFIX}/candidate-experience/${id}`)
		);
	}
}
