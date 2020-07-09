import { IHelpCenterAuthor } from '@gauzy/models';
import { HttpClient } from '@angular/common/http';
import { first } from 'rxjs/operators';
import { Injectable } from '@angular/core';

@Injectable({
	providedIn: 'root'
})
export class HelpCenterAuthorService {
	constructor(private http: HttpClient) {}

	createBulk(
		articleId: string,
		employeeIds: string[]
	): Promise<IHelpCenterAuthor[]> {
		return this.http
			.post<IHelpCenterAuthor[]>('/api/help-center-author/createBulk', {
				articleId,
				employeeIds
			})
			.pipe(first())
			.toPromise();
	}

	findByArticleId(articleId: string): Promise<IHelpCenterAuthor[]> {
		return this.http
			.get<IHelpCenterAuthor[]>(`/api/help-center-author/${articleId}`)
			.pipe(first())
			.toPromise();
	}

	deleteBulkByArticleId(id: string): Promise<any> {
		const data = JSON.stringify({ id });
		return this.http
			.delete('/api/help-center-author/deleteBulkByArticleId', {
				params: { data }
			})
			.pipe(first())
			.toPromise();
	}

	findAll(): Promise<IHelpCenterAuthor[]> {
		return this.http
			.get<IHelpCenterAuthor[]>(`/api/help-center-author`, {})
			.pipe(first())
			.toPromise();
	}
}
