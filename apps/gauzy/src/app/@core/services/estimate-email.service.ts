import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { EstimateEmailFindInput, EstimateEmail } from '@gauzy/models';
import { first } from 'rxjs/operators';

@Injectable()
export class EstimateEmailService {
	constructor(private http: HttpClient) {}

	validate(
		relations: string[],
		findInput: EstimateEmailFindInput
	): Promise<EstimateEmail> {
		const data = JSON.stringify({ relations, findInput });

		return this.http
			.get<EstimateEmail>(`/api/estimate-email/validate`, {
				params: { data }
			})
			.pipe(first())
			.toPromise();
	}
}
