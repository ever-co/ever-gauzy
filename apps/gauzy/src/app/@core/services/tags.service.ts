import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { ITag } from '@gauzy/contracts';
import { firstValueFrom } from 'rxjs';
import { API_PREFIX } from '../constants/app.constants';

@Injectable()
export class TagsService {
	constructor(private http: HttpClient) {}

	insertTags(createTags: ITag[]): Promise<ITag[]> {
		return firstValueFrom(
			this.http
			.post<ITag[]>(`${API_PREFIX}/tags`, createTags)
		);
	}

	insertTag(createTag: ITag): Promise<ITag> {
		return firstValueFrom(
			this.http
			.post<ITag>(`${API_PREFIX}/tags`, createTag)
		);
	}

	getTags(
		relations?: string[],
		findInput?: ITag
	): Promise<{ items: ITag[] }> {
		const data = JSON.stringify({ relations, findInput });
		return firstValueFrom(
			this.http
			.get<{ items: ITag[] }>(`${API_PREFIX}/tags`, {
				params: { data }
			})
		);
	}

	getTagsByLevel(
		findInput?: ITag,
		relations?: string[]
	): Promise<{ items: ITag[] }> {
		const data = JSON.stringify({ relations, findInput });
		return firstValueFrom(
			this.http
			.get<{ items: ITag[] }>(`${API_PREFIX}/tags/level`, {
				params: { data }
			})
		);
	}

	delete(id: string): Promise<any> {
		return firstValueFrom(
			this.http
			.delete(`${API_PREFIX}/tags/${id}`)
		);
	}

	update(id: string, updateInput: ITag) {
		return firstValueFrom(
			this.http
			.put(`${API_PREFIX}/tags/${id}`, updateInput)
		);
	}
	
	findByName(name: string): Promise<{ item: ITag }> {
		return firstValueFrom(
			this.http
			.get<{ item: ITag }>(`${API_PREFIX}/tags/getByName/${name}`)
		);
	}
}
