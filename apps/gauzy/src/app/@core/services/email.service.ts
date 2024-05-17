import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { IEmailHistory, IEmailFindInput, IEmailUpdateInput, IPagination, IResendEmailInput } from '@gauzy/contracts';
import { toParams } from '@gauzy/ui-sdk/common';
import { firstValueFrom } from 'rxjs';
import { API_PREFIX } from '../constants/app.constants';

@Injectable({
	providedIn: 'root'
})
export class EmailService {
	constructor(private readonly http: HttpClient) {}

	getAll(relations: string[] = [], where?: IEmailFindInput, take?: number): Promise<IPagination<IEmailHistory>> {
		const data = { relations, where };
		if (take) {
			data['take'] = take;
		}
		return firstValueFrom(
			this.http.get<IPagination<IEmailHistory>>(`${API_PREFIX}/email`, {
				params: toParams({ ...data })
			})
		);
	}

	update(id: string, body: IEmailUpdateInput): Promise<any> {
		return firstValueFrom(this.http.put<IEmailHistory>(`${API_PREFIX}/email/${id}`, body));
	}

	resend(emailInput: IResendEmailInput): Promise<any> {
		return firstValueFrom(this.http.post<IEmailHistory>(`${API_PREFIX}/email/resend/`, emailInput));
	}
}
