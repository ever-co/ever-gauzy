import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { first } from 'rxjs/operators';
import {
	ICandidateSourceFindInput,
	ICandidateSource,
	ICandidateSourceCreateInput
} from '@gauzy/models';

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
				`/api/candidate-source`,
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
			.post<ICandidateSource>('/api/candidate-source', createInput)
			.pipe(first())
			.toPromise();
	}

	updateBulk(updateInput: ICandidateSource[]): Promise<any> {
		return this.http
			.put('/api/candidate-source/updateBulk', updateInput)
			.pipe(first())
			.toPromise();
	}
}
