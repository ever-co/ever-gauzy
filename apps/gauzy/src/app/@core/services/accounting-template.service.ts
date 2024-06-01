import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { IAccountingTemplateFindInput, IAccountingTemplate } from '@gauzy/contracts';
import { firstValueFrom } from 'rxjs';
import { toParams } from '@gauzy/ui-sdk/common';
import { API_PREFIX } from '@gauzy/ui-sdk/common';

@Injectable({
	providedIn: 'root'
})
export class AccountingTemplateService {
	constructor(private http: HttpClient) {}

	getAll(relations?: string[], where?: IAccountingTemplateFindInput): Promise<{ items: IAccountingTemplate[] }> {
		return firstValueFrom(
			this.http.get<{ items: IAccountingTemplate[] }>(`${API_PREFIX}/accounting-template`, {
				params: toParams({ where, relations })
			})
		);
	}

	getById(id: string): Promise<IAccountingTemplate> {
		return firstValueFrom(this.http.get<IAccountingTemplate>(`${API_PREFIX}/accounting-template/${id}`));
	}

	getTemplate(request?: IAccountingTemplateFindInput): Promise<IAccountingTemplate> {
		return firstValueFrom(
			this.http.get<IAccountingTemplate>(`${API_PREFIX}/accounting-template/template`, {
				params: toParams({ ...request })
			})
		);
	}

	generateTemplatePreview(request?: any): Promise<any> {
		return firstValueFrom(
			this.http.post<any>(`${API_PREFIX}/accounting-template/template/preview`, {
				request
			})
		);
	}

	saveTemplate(data: any): Promise<any> {
		return firstValueFrom(
			this.http.post<any>(`${API_PREFIX}/accounting-template/template/save`, {
				...data
			})
		);
	}

	updateTemplate(id: string, data: any): Promise<any> {
		return firstValueFrom(this.http.put<any>(`${API_PREFIX}/accounting-template/${id}`, data));
	}
}
