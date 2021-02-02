import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { IJobSearchOccupation, IPagination } from '@gauzy/contracts';
import { toParams } from '@gauzy/common-angular';
import { API_PREFIX } from '../constants/app.constants';

@Injectable({
	providedIn: 'root'
})
export class JobSearchOccupationService {
	constructor(private http: HttpClient) {}

	getAll(request?: any) {
		return this.http
			.get<IPagination<IJobSearchOccupation>>(
				`${API_PREFIX}/job-preset/job-search-occupation`,
				{
					params: request ? toParams(request) : {}
				}
			)
			.toPromise();
	}

	create(request?: IJobSearchOccupation) {
		return this.http
			.post<IJobSearchOccupation>(
				`${API_PREFIX}/job-preset/job-search-occupation`,
				request
			)
			.toPromise();
	}
}
