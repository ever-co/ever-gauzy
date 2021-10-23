import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { IEmail, IEmailFindInput, IEmailUpdateInput } from '@gauzy/contracts';
import { firstValueFrom } from 'rxjs';
import { API_PREFIX } from '../constants/app.constants';

@Injectable({
	providedIn: 'root'
})
export class EmailService {
	constructor(private http: HttpClient) {}

	getAll(
		relations?: string[],
		findInput?: IEmailFindInput,
		take?: number
	): Promise<{ items: IEmail[]; total: number }> {
		const data = JSON.stringify({ relations, findInput, take });

		return firstValueFrom(
			this.http
			.get<{ items: IEmail[]; total: number }>(`${API_PREFIX}/email`, {
				params: { data }
			})
		);
	}

	update(id: string, updateInput: IEmailUpdateInput): Promise<any> {
		return firstValueFrom(
			this.http
			.put<IEmail>(`${API_PREFIX}/email/${id}`, updateInput)
		);
	}
}
