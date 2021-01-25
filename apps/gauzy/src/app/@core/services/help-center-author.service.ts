import {
	IHelpCenterAuthor,
	IHelpCenterAuthorCreate,
	IHelpCenterAuthorFind
} from '@gauzy/contracts';
import { HttpClient } from '@angular/common/http';
import { first } from 'rxjs/operators';
import { Injectable } from '@angular/core';

@Injectable({
	providedIn: 'root'
})
export class HelpCenterAuthorService {
	constructor(private http: HttpClient) {}

	createBulk(input: IHelpCenterAuthorCreate): Promise<IHelpCenterAuthor[]> {
		return this.http
			.post<IHelpCenterAuthor[]>(
				'/api/help-center-author/createBulk',
				input
			)
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

	getAll(
		relations?: string[],
		findInput?: IHelpCenterAuthorFind
	): Promise<{ items: any[]; total: number }> {
		const data = JSON.stringify({ relations, findInput });
		return this.http
			.get<{ items: IHelpCenterAuthor[]; total: number }>(
				`/api/help-center-author`,
				{
					params: { data }
				}
			)
			.pipe(first())
			.toPromise();
	}
}
