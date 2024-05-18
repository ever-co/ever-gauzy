import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { IPagination, ITag, ITagFindInput } from '@gauzy/contracts';
import { toParams } from '@gauzy/ui-sdk/common';
import { API_PREFIX } from '@gauzy/ui-sdk/common';
import { CrudService } from './crud/crud.service';

@Injectable()
export class TagsService extends CrudService<ITag> {
	static readonly API_URL = `${API_PREFIX}/tags`;

	constructor(protected readonly http: HttpClient) {
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
