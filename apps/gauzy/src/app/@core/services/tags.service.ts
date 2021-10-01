import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { ITag } from '@gauzy/contracts';
import { first } from 'rxjs/operators';
import { API_PREFIX } from '../constants/app.constants';

@Injectable()
export class TagsService {
	constructor(private http: HttpClient) {}

	insertTags(createTags: ITag[]): Promise<ITag[]> {
		return this.http
			.post<ITag[]>(`${API_PREFIX}/tags`, createTags)
			.pipe(first())
			.toPromise();
	}

	insertTag(createTag: ITag): Promise<ITag> {
		return this.http
			.post<ITag>(`${API_PREFIX}/tags`, createTag)
			.pipe(first())
			.toPromise();
	}

	getAllTags(
		relations?: string[],
		findInput?: ITag
	): Promise<{ items: ITag[] }> {
		const data = JSON.stringify({ relations, findInput });

		return this.http
			.get<{ items: ITag[] }>(`${API_PREFIX}/tags/list`, {
				params: { data }
			})
			.pipe(first())
			.toPromise();
	}

	delete(id: string): Promise<any> {
		return this.http
			.delete(`${API_PREFIX}/tags/${id}`)
			.pipe(first())
			.toPromise();
	}

	update(id: string, updateInput: ITag) {
		return this.http
			.put(`${API_PREFIX}/tags/${id}`, updateInput)
			.pipe(first())
			.toPromise();
	}
	findByName(name: string): Promise<{ item: ITag }> {
		return this.http
			.get<{ item: ITag }>(`${API_PREFIX}/tags/getByName/${name}`)
			.pipe(first())
			.toPromise();
	}

	getAllTagsByOrgLevel(findInput: ITag, relations?: string[]): Promise<any> {
		const data = JSON.stringify({ relations, findInput });
		return this.http
			.get<any>(`${API_PREFIX}/tags/getByOrgId/`, {
				params: { data }
			})
			.pipe(first())
			.toPromise();
	}

	getAllTagsByTenantLevel(
		findInput: ITag,
		relations?: string[]
	): Promise<any> {
		const data = JSON.stringify({ relations, findInput });
		return this.http
			.get<any>(`${API_PREFIX}/tags/getByTenantId/`, {
				params: { data }
			})
			.pipe(first())
			.toPromise();
	}

	getTagUsageCount(organizationId: any): Promise<any> {
		const data = JSON.stringify({ organizationId });
		return this.http
			.get<any>(`${API_PREFIX}/tags/getTagsWithCount`, {
				params: { data }
			})
			.pipe(first())
			.toPromise();
	}
}
