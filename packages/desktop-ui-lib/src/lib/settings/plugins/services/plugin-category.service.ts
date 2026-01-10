import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { IPagination, IPluginCategory } from '@gauzy/contracts';
import { API_PREFIX, toParams } from '@gauzy/ui-core/common';
import { Observable } from 'rxjs';

/**
 * Extended plugin category interface for tree structure
 */
export interface IPluginCategoryTree extends IPluginCategory {
	level: number;
	path: string[];
	hasChildren: boolean;
	childCount: number;
	pluginCount: number;
	children?: IPluginCategoryTree[];
	parent?: IPluginCategory;
}

@Injectable({
	providedIn: 'root'
})
export class PluginCategoryService {
	private readonly endPoint = `${API_PREFIX}/plugin-categories`;

	constructor(private readonly http: HttpClient) {}

	/**
	 * Get all plugin categories with pagination
	 * @param params - Query parameters for filtering and pagination
	 * @returns Observable of paginated plugin categories
	 */
	public getAll<T>(params = {} as T): Observable<IPagination<IPluginCategory>> {
		return this.http.get<IPagination<IPluginCategory>>(this.endPoint, {
			params: toParams(params)
		});
	}

	/**
	 * Get plugin categories in hierarchical tree format
	 * @param params - Query parameters for filtering
	 * @returns Observable of plugin category tree
	 */
	public getTree<T>(params = {} as T): Observable<IPluginCategoryTree[]> {
		return this.http.get<IPluginCategoryTree[]>(this.endPoint, {
			params: toParams({ ...params, format: 'tree' })
		});
	}

	/**
	 * Get a single plugin category by ID
	 * @param id - Category ID
	 * @param params - Query parameters (e.g., relations)
	 * @returns Observable of plugin category
	 */
	public getOne<T>(id: string, params = {} as T): Observable<IPluginCategory> {
		return this.http.get<IPluginCategory>(`${this.endPoint}/${id}`, {
			params: toParams(params)
		});
	}

	/**
	 * Create a new plugin category
	 * @param category - Category data to create
	 * @returns Observable of created plugin category
	 */
	public create(category: Partial<IPluginCategory>): Observable<IPluginCategory> {
		return this.http.post<IPluginCategory>(this.endPoint, category);
	}

	/**
	 * Update an existing plugin category
	 * @param id - Category ID
	 * @param category - Updated category data
	 * @returns Observable of updated plugin category
	 */
	public update(id: string, category: Partial<IPluginCategory>): Observable<IPluginCategory> {
		return this.http.put<IPluginCategory>(`${this.endPoint}/${id}`, category);
	}

	/**
	 * Partially update a plugin category
	 * @param id - Category ID
	 * @param category - Partial category data to update
	 * @returns Observable of updated plugin category
	 */
	public patch(id: string, category: Partial<IPluginCategory>): Observable<IPluginCategory> {
		return this.http.patch<IPluginCategory>(`${this.endPoint}/${id}`, category);
	}

	/**
	 * Delete a plugin category
	 * @param id - Category ID
	 * @returns Observable of void
	 */
	public delete(id: string): Observable<void> {
		return this.http.delete<void>(`${this.endPoint}/${id}`);
	}
}
