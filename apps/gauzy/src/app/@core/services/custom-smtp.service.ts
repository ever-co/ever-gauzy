import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { ICustomSmtp, ICustomSmtpFindInput } from '@gauzy/models';
import { toParams } from '@gauzy/utils';

@Injectable()
export class CustomSmtpService {
	API_URL = '/api/smtp';

	constructor(private http: HttpClient) {}

	saveSMTPSetting(request: ICustomSmtp) {
		return this.http
			.post<ICustomSmtp>(`${this.API_URL}`, request)
			.toPromise();
	}

	updateSMTPSetting(id, request: ICustomSmtp) {
		return this.http
			.put<ICustomSmtp>(`${this.API_URL}/${id}`, request)
			.toPromise();
	}

	getSMTPSetting(request: ICustomSmtpFindInput) {
		return this.http
			.get<ICustomSmtp>(`${this.API_URL}`, {
				params: toParams(request)
			})
			.toPromise();
	}
}
