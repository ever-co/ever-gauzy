import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { ID, IPagination, ITag, ITagFindInput } from '@gauzy/contracts';
import { API_PREFIX, toParams } from '@gauzy/ui-core/common';
import { CrudService } from '../crud/crud.service';

@Injectable({ providedIn: 'root' })
export class TagsService extends CrudService<ITag> {
	static readonly API_URL = `${API_PREFIX}/tags`;

	constructor(http: HttpClient) {
		super(http, TagsService.API_URL);
	}

	/**
	 * Get tags
	 *
	 * @param relations
	 * @param findInput
	 * @returns
	 */
	getTags(where: ITagFindInput, relations: string[] = []): Promise<IPagination<ITag>> {
		return firstValueFrom(
			this.http.get<IPagination<ITag>>(`${API_PREFIX}/tags`, {
				params: toParams({ where, relations })
			})
		);
	}

	/**
	 * Get one tag by its id.
	 *
	 * @param id The tag.
	 * @returns The tag, without its relations or usage counters.
	 */
	getTagById(id: ID): Promise<ITag> {
		return firstValueFrom(this.http.get<ITag>(`${API_PREFIX}/tags/${id}`));
	}

	/**
	 * Get tags by level
	 *
	 * @param where
	 * @param relations
	 * @returns
	 */
	getTagsByLevel(where: ITagFindInput, relations: string[] = []): Promise<IPagination<ITag>> {
		return firstValueFrom(
			this.http.get<IPagination<ITag>>(`${API_PREFIX}/tags/level`, {
				params: toParams({ ...where, relations })
			})
		);
	}
}
