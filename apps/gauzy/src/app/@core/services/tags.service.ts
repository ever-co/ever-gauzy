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

	getAllTags(): Promise<{ items: Tag[] }> {
		return this.http
			.get<{ items: Tag[] }>(`/api/tags`)
			.pipe(first())
			.toPromise();
	}

	delete(id: string): Promise<any> {
		return this.http
			.delete(`/api/tags/${id}`)
			.pipe(first())
			.toPromise();
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
}
