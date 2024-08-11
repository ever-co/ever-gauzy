import { IHelpCenterAuthor, IHelpCenterAuthorCreate, IHelpCenterAuthorFind } from '@gauzy/contracts';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { Injectable } from '@angular/core';
import { API_PREFIX } from '@gauzy/ui-core/common';

@Injectable({
	providedIn: 'root'
})
export class HelpCenterAuthorService {
	constructor(private http: HttpClient) {}

	createBulk(input: IHelpCenterAuthorCreate): Promise<IHelpCenterAuthor[]> {
		return firstValueFrom(
			this.http.post<IHelpCenterAuthor[]>(`${API_PREFIX}/help-center-author/createBulk`, input)
		);
	}

	findByArticleId(articleId: string): Promise<IHelpCenterAuthor[]> {
		return firstValueFrom(
			this.http.get<IHelpCenterAuthor[]>(`${API_PREFIX}/help-center-author/article/${articleId}`)
		);
	}

	deleteBulkByArticleId(articleId: string): Promise<any> {
		return firstValueFrom(this.http.delete(`${API_PREFIX}/help-center-author/article/${articleId}`));
	}

	getAll(relations?: string[], findInput?: IHelpCenterAuthorFind): Promise<{ items: any[]; total: number }> {
		const data = JSON.stringify({ relations, findInput });
		return firstValueFrom(
			this.http.get<{ items: IHelpCenterAuthor[]; total: number }>(`${API_PREFIX}/help-center-author`, {
				params: { data }
			})
		);
	}
}
