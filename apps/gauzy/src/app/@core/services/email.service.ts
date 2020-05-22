import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Email, EmailFindInput } from '@gauzy/models';
import { first } from 'rxjs/operators';

@Injectable({
	providedIn: 'root'
})
export class EmailService {
	constructor(private http: HttpClient) {}

	getAll(
		relations?: string[],
		findInput?: EmailFindInput
	): Promise<{ items: Email[]; total: number }> {
		const data = JSON.stringify({ relations, findInput });

		return this.http
			.get<{ items: Email[]; total: number }>(`/api/email`, {
				params: { data }
			})
			.pipe(first())
			.toPromise();
	}
}
