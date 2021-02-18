import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { first } from 'rxjs/operators';
import { API_PREFIX } from '../constants/app.constants';
import {
	IAccountingTemplateFindInput,
	IAccountingTemplate
} from '@gauzy/contracts';

@Injectable({
	providedIn: 'root'
})
export class AccountingTemplateService {
	constructor(private http: HttpClient) {}

	getAll(
		relations?: string[],
		findInput?: IAccountingTemplateFindInput
	): Promise<{ items: IAccountingTemplate[] }> {
		const data = JSON.stringify({ relations, findInput });

		return this.http
			.get<{ items: IAccountingTemplate[] }>(
				`${API_PREFIX}/accounting-template`,
				{
					params: { data }
				}
			)
			.pipe(first())
			.toPromise();
	}

	getTemplate(
		findInput?: IAccountingTemplateFindInput
	): Promise<IAccountingTemplate> {
		const data = JSON.stringify({ findInput });

		return this.http
			.get<IAccountingTemplate>(
				`${API_PREFIX}/accounting-template/findTemplate`,
				{
					params: { data }
				}
			)
			.pipe(first())
			.toPromise();
	}

	generateTemplatePreview(data: string): Promise<any> {
		return this.http
			.post<any>(`${API_PREFIX}/email-template/emailPreview`, {
				data
			})
			.pipe(first())
			.toPromise();
	}
}
