import { IHelpCenterArticle } from './../../../../../../libs/models/src/lib/help-center-article.model';
import { HttpClient } from '@angular/common/http';
import { first } from 'rxjs/operators';
import { Injectable } from '@angular/core';

@Injectable()
export class HelpCenterArticleService {
	constructor(private http: HttpClient) {}

	create(createInput: IHelpCenterArticle): Promise<IHelpCenterArticle> {
		return this.http
			.post<IHelpCenterArticle>('/api/help-center-article', createInput)
			.pipe(first())
			.toPromise();
	}

	getAll(relations?: string[]): Promise<{ items: any[]; total: number }> {
		const data = JSON.stringify({ relations });
		return this.http
			.get<{ items: IHelpCenterArticle[]; total: number }>(
				`/api/help-center-article`,
				{
					params: { data }
				}
			)
			.pipe(first())
			.toPromise();
	}

	update(id: string, updateInput: any): Promise<any> {
		return this.http
			.put(`/api/help-center-article/${id}`, updateInput)
			.pipe(first())
			.toPromise();
	}

	delete(id: string): Promise<any> {
		return this.http
			.delete(`/api/help-center-article/${id}`)
			.pipe(first())
			.toPromise();
	}
}
