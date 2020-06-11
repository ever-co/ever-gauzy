import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { first } from 'rxjs/operators';
import {
	ICandidateTechnologies,
	ICandidateTechnologiesCreateInput
} from '@gauzy/models';

@Injectable()
export class CandidateTechnologiesService {
	constructor(private http: HttpClient) {}

	create(
		createInput: ICandidateTechnologiesCreateInput
	): Promise<ICandidateTechnologies> {
		return this.http
			.post<ICandidateTechnologies>(
				'/api/candidate-technologies',
				createInput
			)
			.pipe(first())
			.toPromise();
	}

	getAll(): Promise<{ items: any[]; total: number }> {
		return this.http
			.get<{ items: ICandidateTechnologies[]; total: number }>(
				`/api/candidate-technologies`
			)
			.pipe(first())
			.toPromise();
	}

	update(id: string, updateInput: any): Promise<any> {
		return this.http
			.put(`/api/candidate-technologies/${id}`, updateInput)
			.pipe(first())
			.toPromise();
	}

	delete(id: string): Promise<any> {
		return this.http
			.delete(`/api/candidate-technologies/${id}`)
			.pipe(first())
			.toPromise();
	}
}
