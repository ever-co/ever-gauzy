import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { EmailTemplate, EmailTemplateFindInput } from '@gauzy/models';
import { first } from 'rxjs/operators';

@Injectable({
	providedIn: 'root'
})
export class EmailTemplateService {
	constructor(private http: HttpClient) {}

	getAll(
		relations?: string[],
		findInput?: EmailTemplateFindInput
	): Promise<{ items: EmailTemplate[]; total: number }> {
		const data = JSON.stringify({ relations, findInput });

		return this.http
			.get<{ items: EmailTemplate[]; total: number }>(
				`/api/email-template`,
				{
					params: { data }
				}
			)
			.pipe(first())
			.toPromise();
	}
}
