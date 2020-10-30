import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { IJobSearchCategory, IPagination } from '@gauzy/models';
import { toParams } from '@gauzy/utils';

@Injectable({
	providedIn: 'root'
})
export class JobSearchCategoryService {
	constructor(private http: HttpClient) {}

	getAll(request?: any) {
		return this.http
			.get<IPagination<IJobSearchCategory>>(
				`/api/job-preset/job-search-category`,
				{
					params: request ? toParams(request) : {}
				}
			)
			.toPromise();
	}

	create(request?: IJobSearchCategory) {
		console.log('createNewCategories', { request });

		return this.http
			.post<IJobSearchCategory>(
				`/api/job-preset/job-search-category`,
				request
			)
			.toPromise();
	}
}
