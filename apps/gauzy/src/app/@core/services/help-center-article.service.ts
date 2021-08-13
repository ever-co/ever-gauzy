import { IHelpCenterArticle } from '@gauzy/contracts';
import { HttpClient } from '@angular/common/http';
import { first } from 'rxjs/operators';
import { Injectable } from '@angular/core';
import { API_PREFIX } from '../constants/app.constants';

@Injectable({
	providedIn: 'root'
})
export class HelpCenterArticleService {
	constructor(private http: HttpClient) {}

	create(createInput: IHelpCenterArticle): Promise<IHelpCenterArticle> {
		return this.http
			.post<IHelpCenterArticle>(
				`${API_PREFIX}/help-center-article`,
				createInput
			)
			.pipe(first())
			.toPromise();
	}

	findByCategoryId(categoryId: string): Promise<IHelpCenterArticle[]> {
		return this.http
			.get<IHelpCenterArticle[]>(
				`${API_PREFIX}/help-center-article/category/${categoryId}`
			)
			.pipe(first())
			.toPromise();
	}

	update(id: string, updateInput: any): Promise<any> {
		return this.http
			.put(`${API_PREFIX}/help-center-article/${id}`, updateInput)
			.pipe(first())
			.toPromise();
	}

	delete(id: string): Promise<any> {
		return this.http
			.delete(`${API_PREFIX}/help-center-article/${id}`)
			.pipe(first())
			.toPromise();
	}

	deleteBulkByCategoryId(categoryId: string): Promise<any> {
		return this.http
			.delete(`${API_PREFIX}/help-center-article/category/${categoryId}`)
			.pipe(first())
			.toPromise();
	}
}
