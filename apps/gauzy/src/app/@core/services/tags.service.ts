import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Tag } from '@gauzy/models';
import { first } from 'rxjs/operators';

@Injectable()
export class TagsService {
	constructor(private http: HttpClient) {}

	insertTags(createTags: Tag[]): Promise<Tag[]> {
		return this.http
			.post<Tag[]>('/api/tags', createTags)
			.pipe(first())
			.toPromise();
	}

	insertTag(createTag: Tag): Promise<Tag> {
		return this.http
			.post<Tag>('/api/tags', createTag)
			.pipe(first())
			.toPromise();
	}

	getAllTags(
		relations?: string[],
		findInput?: Tag
	): Promise<{ items: Tag[] }> {
		const data = JSON.stringify({ relations, findInput });

		return this.http
			.get<{ items: Tag[] }>(`/api/tags`, {
				params: { data }
			})
			.pipe(first())
			.toPromise();
	}

	delete(id: string): Promise<any> {
		return this.http.delete(`/api/tags/${id}`).pipe(first()).toPromise();
	}

	update(id: string, updateInput: Tag) {
		return this.http
			.put(`/api/tags/${id}`, updateInput)
			.pipe(first())
			.toPromise();
	}
	findByName(name: string): Promise<{ item: Tag }> {
		return this.http
			.get<{ item: Tag }>(`/api/tags/getByName/${name}`)
			.pipe(first())
			.toPromise();
	}

	getAllTagsByOrgLevel(orgId: any, relations?: string[]): Promise<any> {
		const data = JSON.stringify({ relations, orgId });
		return this.http
			.get<any>(`/api/tags/getByOrgId/`, {
				params: { data }
			})
			.pipe(first())
			.toPromise();
	}

	getAllTagsByTenantLevel(tenantId: any, relations?: string[]): Promise<any> {
		const data = JSON.stringify({ relations, tenantId });
		return this.http
			.get<any>(`/api/tags/getByTenantId/`, {
				params: { data }
			})
			.pipe(first())
			.toPromise();
	}

	getTagUsageCount(orgId: any): Promise<any> {
		const data = JSON.stringify({ orgId });
		return this.http
			.get<any>(`api/tags/getTagsWithCount`, {
				params: { data }
			})
			.pipe(first())
			.toPromise();
	}
}
