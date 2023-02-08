import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { IPagination, ITag, ITagCreateInput, ITagFindInput, ITagUpdateInput } from '@gauzy/contracts';
import { toParams } from '@gauzy/common-angular';
import { API_PREFIX } from '../constants/app.constants';

@Injectable()
export class TagsService {

	constructor(
		private readonly http: HttpClient
	) { }

	create(tag: ITagCreateInput): Promise<ITag> {
		return firstValueFrom(
			this.http.post<ITagCreateInput>(`${API_PREFIX}/tags`, tag)
		);
	}

	/**
	 * Get tags
	 *
	 * @param relations
	 * @param findInput
	 * @returns
	 */
	getTags(
		relations?: string[],
		findInput?: ITagFindInput
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

	update(id: ITag['id'], tag: ITagUpdateInput): Promise<ITagUpdateInput> {
		return firstValueFrom(
			this.http.put<ITagUpdateInput>(`${API_PREFIX}/tags/${id}`, tag)
		);
	}
}
