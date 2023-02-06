import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { IPagination, ITag, ITagFindInput } from '@gauzy/contracts';
import { firstValueFrom } from 'rxjs';
import { API_PREFIX } from '../constants/app.constants';
import { toParams } from 'packages/common-angular/dist';

@Injectable()
export class TagsService {

	constructor(
		private readonly http: HttpClient
	) { }

	insertTags(createTags: ITag[]): Promise<ITag[]> {
		return firstValueFrom(
			this.http
				.post<ITag[]>(`${API_PREFIX}/tags`, createTags)
		);
	}

	insertTag(createTag: ITag): Promise<ITag> {
		return firstValueFrom(
			this.http.post<ITag>(`${API_PREFIX}/tags`, createTag)
		);
	}

	getTags(
		relations?: string[],
		findInput?: ITag
	): Promise<IPagination<ITag>> {
		const data = JSON.stringify({ relations, findInput });
		return firstValueFrom(
			this.http.get<IPagination<ITag>>(`${API_PREFIX}/tags`, {
				params: { data }
			})
		);
	}

	/**
	 * Get tags by level
	 *
	 * @param where
	 * @param relations
	 * @returns
	 */
	getTagsByLevel(
		where: ITagFindInput,
		relations: string[] = []
	): Promise<IPagination<ITag>> {
		return firstValueFrom(
			this.http.get<IPagination<ITag>>(`${API_PREFIX}/tags/level`, {
				params: toParams({ ...where, relations })
			})
		);
	}

	delete(id: ITag['id']): Promise<any> {
		return firstValueFrom(
			this.http.delete(`${API_PREFIX}/tags/${id}`)
		);
	}

	update(id: string, updateInput: ITag) {
		return firstValueFrom(
			this.http.put(`${API_PREFIX}/tags/${id}`, updateInput)
		);
	}

	findByName(name: string): Promise<{ item: ITag }> {
		return firstValueFrom(
			this.http.get<{ item: ITag }>(`${API_PREFIX}/tags/getByName/${name}`)
		);
	}
}
