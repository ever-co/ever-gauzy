import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import {
	IEmailTemplate,
	IEmailTemplateFindInput,
	ICustomizeEmailTemplateFindInput,
	ICustomizableEmailTemplate,
	IEmailTemplateSaveInput,
	IPagination
} from '@gauzy/contracts';
import { firstValueFrom } from 'rxjs';
import { toParams } from '@gauzy/ui-sdk/common';
import { API_PREFIX } from '@gauzy/ui-sdk/common';

@Injectable({
	providedIn: 'root'
})
export class EmailTemplateService {
	constructor(private http: HttpClient) {}

	getAll(where: IEmailTemplateFindInput): Promise<IPagination<IEmailTemplate>> {
		return firstValueFrom(
			this.http.get<IPagination<IEmailTemplate>>(`${API_PREFIX}/email-template`, {
				params: toParams({ where })
			})
		);
	}

	getTemplate(where?: ICustomizeEmailTemplateFindInput): Promise<ICustomizableEmailTemplate> {
		return firstValueFrom(
			this.http.get<ICustomizableEmailTemplate>(`${API_PREFIX}/email-template/template`, {
				params: toParams({ ...where })
			})
		);
	}

	generateTemplatePreview(data: string): Promise<{ html: string }> {
		return firstValueFrom(
			this.http.post<{ html: string }>(`${API_PREFIX}/email-template/template/preview`, {
				data
			})
		);
	}

	saveEmailTemplate(data: IEmailTemplateSaveInput): Promise<IEmailTemplate> {
		return firstValueFrom(
			this.http.post<IEmailTemplate>(`${API_PREFIX}/email-template/template/save`, {
				...data
			})
		);
	}
}
