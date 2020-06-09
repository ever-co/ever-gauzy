import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { first } from 'rxjs/operators';
import {
	ICandidatePersonalQualities,
	ICandidatePersonalQualitiesCreateInput
} from '@gauzy/models';

@Injectable()
export class CandidatePersonalQualitiesService {
	constructor(private http: HttpClient) {}

	create(
		createInput: ICandidatePersonalQualitiesCreateInput
	): Promise<ICandidatePersonalQualities> {
		return this.http
			.post<ICandidatePersonalQualities>(
				'/api/candidate-personal-qualities',
				createInput
			)
			.pipe(first())
			.toPromise();
	}

	getAll(): Promise<{ items: any[]; total: number }> {
		return this.http
			.get<{ items: ICandidatePersonalQualities[]; total: number }>(
				`/api/candidate-personal-qualities`
			)
			.pipe(first())
			.toPromise();
	}

	update(id: string, updateInput: any): Promise<any> {
		return this.http
			.put(`/api/candidate-personal-qualities/${id}`, updateInput)
			.pipe(first())
			.toPromise();
	}

	delete(id: string): Promise<any> {
		return this.http
			.delete(`/api/candidate-personal-qualities/${id}`)
			.pipe(first())
			.toPromise();
	}
}
