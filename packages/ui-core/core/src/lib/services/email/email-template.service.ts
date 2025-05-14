import { inject, Injectable } from '@angular/core';
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
import { API_PREFIX, buildHttpParams } from '@gauzy/ui-core/common';

@Injectable({
	providedIn: 'root'
})
export class EmailTemplateService {
	private http = inject(HttpClient);

	getAll(where: IEmailTemplateFindInput): Promise<IPagination<IEmailTemplate>> {
		const params = buildHttpParams({ where });
		return firstValueFrom(this.http.get<IPagination<IEmailTemplate>>(`${API_PREFIX}/email-template`, { params }));
	}

	getTemplate(where?: ICustomizeEmailTemplateFindInput): Promise<ICustomizableEmailTemplate> {
		return firstValueFrom(
			this.http.get<ICustomizableEmailTemplate>(`${API_PREFIX}/email-template/template`, {
				params: buildHttpParams({ ...where })
			})
		);
	}

	generateTemplatePreview(data: string): Promise<{ html: string }> {
		return firstValueFrom(
			this.http.post<{ html: string }>(`${API_PREFIX}/email-template/template/preview`, { data })
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
