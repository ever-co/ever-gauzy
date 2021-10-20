import { IHelpCenterArticle } from '@gauzy/contracts';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { Injectable } from '@angular/core';
import { API_PREFIX } from '../constants/app.constants';

@Injectable({
	providedIn: 'root'
})
export class HelpCenterArticleService {
	constructor(private http: HttpClient) {}

	create(createInput: IHelpCenterArticle): Promise<IHelpCenterArticle> {
		return firstValueFrom(
			this.http
			.post<IHelpCenterArticle>(
				`${API_PREFIX}/help-center-article`,
				createInput
			)
		);
	}

	findByCategoryId(categoryId: string): Promise<IHelpCenterArticle[]> {
		return firstValueFrom(
			this.http
			.get<IHelpCenterArticle[]>(
				`${API_PREFIX}/help-center-article/category/${categoryId}`
			)
		);
	}

	update(id: string, updateInput: any): Promise<any> {
		return firstValueFrom(
			this.http
			.put(`${API_PREFIX}/help-center-article/${id}`, updateInput)
		);
	}

	delete(id: string): Promise<any> {
		return firstValueFrom(
			this.http
			.delete(`${API_PREFIX}/help-center-article/${id}`)
		);
	}

	deleteBulkByCategoryId(categoryId: string): Promise<any> {
		return firstValueFrom(
			this.http
			.delete(`${API_PREFIX}/help-center-article/category/${categoryId}`)
		);
	}
}
