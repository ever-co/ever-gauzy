import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { IPagination, ITagType, ITagTypesFindInput } from '@gauzy/contracts';
import { API_PREFIX, toParams } from '@gauzy/ui-core/common';
import { CrudService } from '../crud/crud.service';

@Injectable({ providedIn: 'root' })
export class TagTypesService extends CrudService<ITagType> {
	static readonly API_URL = `${API_PREFIX}/tag-types`;

	constructor(http: HttpClient) {
		super(http, TagTypesService.API_URL);
	}

	/**
	 * Get all tag types with pagination and filter options
	 *
	 * @param where - Filtering options
	 * @param relations - Optional relations to include in the response
	 * @returns A promise resolving to a paginated list of tag types
	 */
	getTagTypes(where: ITagTypesFindInput, relations: string[] = []): Promise<IPagination<ITagType>> {
		return firstValueFrom(
			this.http.get<IPagination<ITagType>>(`${TagTypesService.API_URL}`, {
				params: toParams({ where, relations })
			})
		);
	}

	/**
	 * Get the count of tag types
	 *
	 * @param where - Optional filter criteria
	 * @returns A promise resolving to the count of tag types
	 */
	getTagTypesCount(where: ITagTypesFindInput): Promise<number> {
		return firstValueFrom(
			this.http.get<number>(`${TagTypesService.API_URL}/count`, {
				params: toParams({ where })
			})
		);
	}

	/**
	 * Create a new tag type
	 *
	 * @param tagType - The tag type data to create
	 * @returns A promise resolving to the created tag type
	 */
	createTagType(tagType: ITagType): Promise<ITagType> {
		return firstValueFrom(this.http.post<ITagType>(`${TagTypesService.API_URL}`, tagType));
	}

	/**
	 * Update an existing tag type by its ID
	 *
	 * @param id - The ID of the tag type to update
	 * @param tagType - The new data for the tag type
	 * @returns A promise resolving to the updated tag type
	 */
	updateTagType(id: string, tagType: ITagType): Promise<ITagType> {
		return firstValueFrom(this.http.put<ITagType>(`${TagTypesService.API_URL}/${id}`, tagType));
	}
}
