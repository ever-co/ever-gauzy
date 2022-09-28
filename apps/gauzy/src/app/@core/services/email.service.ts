import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { IEmail, IEmailFindInput, IEmailUpdateInput, IPagination } from '@gauzy/contracts';
import { toParams } from '@gauzy/common-angular';
import { firstValueFrom } from 'rxjs';
import { API_PREFIX } from '../constants/app.constants';

@Injectable({
	providedIn: 'root'
})
export class EmailService {

	constructor(
		private readonly http: HttpClient
	) {}

	getAll(
		relations: string[] = [],
		where?: IEmailFindInput,
		take?: number
	): Promise<IPagination<IEmail>> {
		const data = { relations, where };
		if (take) {
			data['take'] = take;
		}
		return firstValueFrom(
			this.http.get<IPagination<IEmail>>(`${API_PREFIX}/email`, {
				params: toParams({ ...data })
			})
		);
	}

	update(id: string, body: IEmailUpdateInput): Promise<any> {
		return firstValueFrom(
			this.http.put<IEmail>(`${API_PREFIX}/email/${id}`, body)
		);
	}
}
