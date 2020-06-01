import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import {
	EmailTemplate,
	EmailTemplateFindInput,
	CustomizeEmailTemplateFindInput,
	CustomizableEmailTemplate
} from '@gauzy/models';
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
	getTemplate(
		findInput?: CustomizeEmailTemplateFindInput
	): Promise<CustomizableEmailTemplate> {
		const data = JSON.stringify({ findInput });

		return this.http
			.get<CustomizableEmailTemplate>(
				`/api/email-template/findTemplate`,
				{
					params: { data }
				}
			)
			.pipe(first())
			.toPromise();
	}

	generateTemplatePreview(data: string): Promise<{ html: string }> {
		return this.http
			.post<{ html: string }>(`/api/email-template/emailPreview`, {
				data
			})
			.pipe(first())
			.toPromise();
	}
}
