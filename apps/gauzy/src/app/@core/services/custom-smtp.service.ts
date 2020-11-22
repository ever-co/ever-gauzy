import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { ICustomSmtp, ICustomSmtpFind } from '@gauzy/models';
import { toParams } from '@gauzy/utils';

@Injectable()
export class CustomSmtpService {
	API_URL = '/api/smtp';

	constructor(private http: HttpClient) {}

	saveSMTPSetting(request: ICustomSmtp) {
		return this.http
			.post<ICustomSmtp>(`${this.API_URL}/tenant`, request)
			.toPromise();
	}

	updateSMTPSetting(id, request: ICustomSmtp) {
		return this.http
			.put<ICustomSmtp>(`${this.API_URL}/tenant/${id}`, request)
			.toPromise();
	}

	getSMTPSetting(request: ICustomSmtpFind) {
		return this.http
			.get<ICustomSmtp>(`${this.API_URL}/tenant`, {
				params: toParams(request)
			})
			.toPromise();
	}
}
