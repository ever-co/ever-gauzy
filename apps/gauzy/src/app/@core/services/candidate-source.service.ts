import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { first } from 'rxjs/operators';
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
	constructor(private http: HttpClient) {}

	getAll(
		findInput?: ICandidateSourceFindInput
	): Promise<{ items: any[]; total: number }> {
		const data = JSON.stringify({ findInput });
		return this.http
			.get<{ items: ICandidateSource[]; total: number }>(
				`${API_PREFIX}/candidate-source`,
				{
					params: { data }
				}
			)
			.pipe(first())
			.toPromise();
	}

	create(
		createInput: ICandidateSourceCreateInput
	): Promise<ICandidateSource> {
		return this.http
			.post<ICandidateSource>(
				`${API_PREFIX}/candidate-source`,
				createInput
			)
			.pipe(first())
			.toPromise();
	}

	updateBulk(updateInput: ICandidateSource[]): Promise<any> {
		return this.http
			.put(`${API_PREFIX}/candidate-source/bulk`, updateInput)
			.pipe(first())
			.toPromise();
	}
}
