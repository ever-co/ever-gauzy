import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import {
	IEmailTemplate,
	IEmailTemplateFindInput,
	ICustomizeEmailTemplateFindInput,
	ICustomizableEmailTemplate,
	IEmailTemplateSaveInput
} from '@gauzy/contracts';
import { first } from 'rxjs/operators';
import { API_PREFIX } from '../constants/app.constants';

@Injectable({
	providedIn: 'root'
})
export class EmailTemplateService {
	constructor(private http: HttpClient) {}

	getAll(
		relations?: string[],
		findInput?: IEmailTemplateFindInput
	): Promise<{ items: IEmailTemplate[]; total: number }> {
		const data = JSON.stringify({ relations, findInput });

		return this.http
			.get<{ items: IEmailTemplate[]; total: number }>(
				`${API_PREFIX}/email-template`,
				{
					params: { data }
				}
			)
			.pipe(first())
			.toPromise();
	}
	getTemplate(
		findInput?: ICustomizeEmailTemplateFindInput
	): Promise<ICustomizableEmailTemplate> {
		const data = JSON.stringify({ findInput });

		return this.http
			.get<ICustomizableEmailTemplate>(
				`${API_PREFIX}/email-template/template`,
				{
					params: { data }
				}
			)
			.pipe(first())
			.toPromise();
	}

	generateTemplatePreview(data: string): Promise<{ html: string }> {
		return this.http
			.post<{ html: string }>(
				`${API_PREFIX}/email-template/template/preview`,
				{
					data
				}
			)
			.pipe(first())
			.toPromise();
	}

	saveEmailTemplate(data: IEmailTemplateSaveInput): Promise<IEmailTemplate> {
		return this.http
			.post<IEmailTemplate>(`${API_PREFIX}/email-template/template/save`, {
				data
			})
			.pipe(first())
			.toPromise();
	}
}
