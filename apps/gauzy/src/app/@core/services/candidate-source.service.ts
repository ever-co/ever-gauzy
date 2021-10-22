import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import {
	ICandidateSourceFindInput,
	ICandidateSource,
	ICandidateSourceCreateInput
} from '@gauzy/contracts';
import { API_PREFIX } from '../constants/app.constants';

@Injectable({
	providedIn: 'root'
})
export class CandidateSourceService {
	constructor(private http: HttpClient) { }

	getAll(
		findInput?: ICandidateSourceFindInput
	): Promise<{ items: any[]; total: number }> {
		const data = JSON.stringify({ findInput });
		return firstValueFrom(
			this.http
				.get<{ items: ICandidateSource[]; total: number }>(
					`${API_PREFIX}/candidate-source`,
					{
						params: { data }
					}
				)
		);
	}

	create(
		createInput: ICandidateSourceCreateInput
	): Promise<ICandidateSource> {
		return firstValueFrom(
			this.http
				.post<ICandidateSource>(
					`${API_PREFIX}/candidate-source`,
					createInput
				)
		);
	}

	updateBulk(updateInput: ICandidateSource[]): Promise<any> {
		return firstValueFrom(
			this.http
				.put(`${API_PREFIX}/candidate-source/bulk`, updateInput)
		);
	}
}
