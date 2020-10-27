import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { JobSearchOccupation, Pagination } from '@gauzy/models';
import { toParams } from '@gauzy/utils';

@Injectable({
	providedIn: 'root'
})
export class JobSearchOccupationService {
	constructor(private http: HttpClient) {}

	getAll(request?: any) {
		return this.http
			.get<Pagination<JobSearchOccupation>>(
				`/api/job-preset/job-search-occupation`,
				{
					params: request ? toParams(request) : {}
				}
			)
			.toPromise();
	}

	create(request?: JobSearchOccupation) {
		return this.http
			.post<JobSearchOccupation>(
				`/api/job-preset/job-search-occupation`,
				request
			)
			.toPromise();
	}
}
