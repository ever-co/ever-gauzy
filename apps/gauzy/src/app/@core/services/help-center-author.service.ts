import {
	IHelpCenterAuthor,
	IHelpCenterAuthorCreate,
	IHelpCenterAuthorFind
} from '@gauzy/contracts';
import { HttpClient } from '@angular/common/http';
import { first } from 'rxjs/operators';
import { Injectable } from '@angular/core';
import { API_PREFIX } from '../constants/app.constants';

@Injectable({
	providedIn: 'root'
})
export class HelpCenterAuthorService {
	constructor(private http: HttpClient) {}

	createBulk(input: IHelpCenterAuthorCreate): Promise<IHelpCenterAuthor[]> {
		return this.http
			.post<IHelpCenterAuthor[]>(
				`${API_PREFIX}/help-center-author/createBulk`,
				input
			)
			.pipe(first())
			.toPromise();
	}

	findByArticleId(articleId: string): Promise<IHelpCenterAuthor[]> {
		return this.http
			.get<IHelpCenterAuthor[]>(
				`${API_PREFIX}/help-center-author/article/${articleId}`
			)
			.pipe(first())
			.toPromise();
	}

	deleteBulkByArticleId(articleId: string): Promise<any> {
		return this.http
			.delete(`${API_PREFIX}/help-center-author/article/${articleId}`)
			.pipe(first())
			.toPromise();
	}

	getAll(
		relations?: string[],
		findInput?: IHelpCenterAuthorFind
	): Promise<{ items: any[]; total: number }> {
		const data = JSON.stringify({ relations, findInput });
		return this.http
			.get<{ items: IHelpCenterAuthor[]; total: number }>(
				`${API_PREFIX}/help-center-author`,
				{
					params: { data }
				}
			)
			.pipe(first())
			.toPromise();
	}
}
