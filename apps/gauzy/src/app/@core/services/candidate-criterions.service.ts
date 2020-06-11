import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { first } from 'rxjs/operators';
import {
	ICandidateCriterions,
	ICandidateCriterionsCreateInput
} from '@gauzy/models';

@Injectable()
export class CandidateCriterionsService {
	constructor(private http: HttpClient) {}

	create(
		createInput: ICandidateCriterionsCreateInput
	): Promise<ICandidateCriterions> {
		return this.http
			.post<ICandidateCriterions>(
				'/api/candidate-criterions',
				createInput
			)
			.pipe(first())
			.toPromise();
	}

	getAll(): Promise<{ items: any[]; total: number }> {
		return this.http
			.get<{ items: ICandidateCriterions[]; total: number }>(
				`/api/candidate-criterions`
			)
			.pipe(first())
			.toPromise();
	}

	update(id: string, updateInput: any): Promise<any> {
		return this.http
			.put(`/api/candidate-criterions/${id}`, updateInput)
			.pipe(first())
			.toPromise();
	}

	delete(id: string): Promise<any> {
		return this.http
			.delete(`/api/candidate-criterions/${id}`)
			.pipe(first())
			.toPromise();
	}
}
