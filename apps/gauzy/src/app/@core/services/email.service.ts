import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { IEmail, IEmailFindInput, IEmailUpdateInput } from '@gauzy/contracts';
import { first } from 'rxjs/operators';

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

		return this.http
			.get<{ items: IEmail[]; total: number }>(`/api/email`, {
				params: { data }
			})
			.pipe(first())
			.toPromise();
	}

	update(id: string, updateInput: IEmailUpdateInput): Promise<any> {
		return this.http
			.put<IEmail>(`api/email/${id}`, updateInput)
			.pipe(first())
			.toPromise();
	}
}
