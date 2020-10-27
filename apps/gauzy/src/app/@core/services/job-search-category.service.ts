import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { JobSearchCategory, Pagination } from '@gauzy/models';
import { toParams } from '@gauzy/utils';

@Injectable({
	providedIn: 'root'
})
export class JobSearchCategoryService {
	constructor(private http: HttpClient) {}

	getAll(request?: any) {
		return this.http
			.get<Pagination<JobSearchCategory>>(
				`/api/job-preset/job-search-category`,
				{
					params: request ? toParams(request) : {}
				}
			)
			.toPromise();
	}

	create(request?: JobSearchCategory) {
		console.log('createNewCategories', { request });

		return this.http
			.post<JobSearchCategory>(
				`/api/job-preset/job-search-category`,
				request
			)
			.toPromise();
	}
}
