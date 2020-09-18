import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { IEstimateEmailFindInput, IEstimateEmail } from '@gauzy/models';
import { first } from 'rxjs/operators';

@Injectable()
export class EstimateEmailService {
	constructor(private http: HttpClient) {}

	validate(
		relations: string[],
		findInput: IEstimateEmailFindInput
	): Promise<IEstimateEmail> {
		const data = JSON.stringify({ relations, findInput });

		return this.http
			.get<IEstimateEmail>(`/api/estimate-email/validate`, {
				params: { data }
			})
			.pipe(first())
			.toPromise();
	}
}
