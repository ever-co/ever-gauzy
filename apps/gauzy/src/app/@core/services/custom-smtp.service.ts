import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { ICustomSmtp, ICustomSmtpFindInput } from '@gauzy/contracts';
import { toParams } from '@gauzy/common-angular';
import { API_PREFIX } from '../constants/app.constants';

@Injectable()
export class CustomSmtpService {
	API_URL = `${API_PREFIX}/smtp`;

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
			.get<ICustomSmtp>(`${this.API_URL}/setting`, {
				params: toParams(request)
			})
			.toPromise();
	}

	validateSMTPSetting(request: ICustomSmtp) {
		return this.http
			.post<boolean>(`${this.API_URL}/validate`, request)
			.toPromise();
	}
}
