import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { IEstimateEmailFindInput, IEstimateEmail } from '@gauzy/contracts';
import { firstValueFrom } from 'rxjs';
import { API_PREFIX } from '../constants/app.constants';

@Injectable()
export class EstimateEmailService {
	constructor(private http: HttpClient) {}

	validate(
		relations: string[],
		findInput: IEstimateEmailFindInput
	): Promise<IEstimateEmail> {
		const data = JSON.stringify({ relations, findInput });

		return firstValueFrom(
			this.http
			.get<IEstimateEmail>(`${API_PREFIX}/estimate-email/validate`, {
				params: { data }
			})
		);
	}
}
