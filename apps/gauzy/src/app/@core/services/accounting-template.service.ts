import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { first } from 'rxjs/operators';
import { API_PREFIX } from '../constants/app.constants';
import {
	IAccountingTemplateFindInput,
	IAccountingTemplate
} from '@gauzy/contracts';
import { firstValueFrom } from 'rxjs';

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
		return firstValueFrom(
			this.http
			.get<{ items: IAccountingTemplate[] }>(
				`${API_PREFIX}/accounting-template`,
				{
					params: { data }
				}
			)
		);
	}

	getById(id: string): Promise<IAccountingTemplate> {
		return firstValueFrom(
			this.http
			.get<IAccountingTemplate>(
				`${API_PREFIX}/accounting-template/${id}`
			)
		);
	}

	getTemplate(
		findInput?: IAccountingTemplateFindInput
	): Promise<IAccountingTemplate> {
		const data = JSON.stringify({ findInput });
		return firstValueFrom(
			this.http
			.get<IAccountingTemplate>(
				`${API_PREFIX}/accounting-template/template`,
				{
					params: { data }
				}
			)
		);
	}

	generateTemplatePreview(request?: any): Promise<any> {
		return firstValueFrom(
			this.http
			.post<any>(`${API_PREFIX}/accounting-template/template/preview`, {
				request
			})
		);
	}

	saveTemplate(data: any): Promise<any> {
		return firstValueFrom(
			this.http
			.post<any>(`${API_PREFIX}/accounting-template/template/save`, {
				data
			})
		);
	}

	updateTemplate(id: string, data: any): Promise<any> {
		return firstValueFrom(
			this.http
			.put<any>(
				`${API_PREFIX}/accounting-template/${id}`,
				data
			)
		);
	}
}
