import { HttpClient, HttpEvent, HttpEventType, HttpResponse } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { ID, IPagination, IPlugin, IPluginInstallation, IPluginSource, IPluginVersion } from '@gauzy/contracts';
import { API_PREFIX, toParams } from '@gauzy/ui-core/common';
import { catchError, map, Observable } from 'rxjs';
import { Store } from '../../../services';
import { PluginFormDataBuilder } from './builders/form-data.builder';

@Injectable({
	providedIn: 'root'
})
export class PluginService {
	private readonly endPoint = `${API_PREFIX}/plugins`;

	constructor(private readonly http: HttpClient, private readonly store: Store) {}

	public getAll<T>(params = {} as T): Observable<IPagination<IPlugin>> {
		return this.http.get<IPagination<IPlugin>>(this.endPoint, {
			params: toParams(params)
		});
	}

	public getOne<T>(id: string, params = {} as T): Observable<IPlugin> {
		return this.http.get<IPlugin>(`${this.endPoint}/${id}`, { params: toParams(params) });
	}

	public upload(plugin: IPlugin): Observable<{ plugin?: IPlugin; progress?: number }> {
		const formData = new PluginFormDataBuilder(this.store)
			.appendPlugin(plugin)
			.appendFiles(plugin?.version?.sources)
			.build();

		return this.http
			.post<IPlugin>(this.endPoint, formData, {
				reportProgress: true,
				observe: 'events'
			})
			.pipe(
				this.handleProgressResponse<IPlugin>(),
				map((res) => ({ ...res, plugin: res?.data }))
			);
	}

	public update(pluginId: ID, plugin: Partial<IPlugin>): Observable<IPlugin> {
		const formData = new PluginFormDataBuilder(this.store)
			.appendPlugin(plugin)
			.appendFiles(plugin?.version?.sources)
			.build();

		return this.http.put<IPlugin>(`${this.endPoint}/${pluginId}`, formData);
	}

	public delete(id: string): Observable<IPlugin> {
		return this.http.delete<IPlugin>(`${this.endPoint}/${id}`);
	}

	public search<T>(params = {} as T): Observable<IPagination<IPlugin>> {
		return this.getAll(params);
	}

	public ratePlugin(pluginId: string, rating: number, review?: string): Observable<any> {
		return this.http.post<any>(`${this.endPoint}/${pluginId}/ratings`, { rating, review });
	}

	public verify({
		pluginId,
		versionId,
		signature
	}: {
		pluginId: string;
		versionId: string;
		signature: string;
	}): Observable<IPlugin> {
		return this.http.post<IPlugin>(`${this.endPoint}/${pluginId}/verify`, { versionId, signature });
	}

	public install(pluginInstallRequest: { pluginId: string; versionId: string }): Observable<IPluginInstallation> {
		const { pluginId, versionId } = pluginInstallRequest;
		return this.http.post<IPluginInstallation>(`${this.endPoint}/${pluginId}/installations`, {
			versionId
		});
	}

	public uninstall(pluginId: string, installationId: string, reason: string): Observable<void> {
		return this.http.delete<void>(`${this.endPoint}/${pluginId}/installations/${installationId}`, {
			body: { reason }
		});
	}

	public activate(pluginId: string, installationId: string): Observable<void> {
		return this.http.patch<void>(`${this.endPoint}/${pluginId}/installations/${installationId}`, {
			status: 'active'
		});
	}

	public deactivate(pluginId: string, installationId: string): Observable<void> {
		return this.http.patch<void>(`${this.endPoint}/${pluginId}/installations/${installationId}`, {
			status: 'inactive'
		});
	}

	public addVersion(
		pluginId: string,
		version: IPluginVersion
	): Observable<{ version?: IPluginVersion; progress?: number }> {
		const formData = new PluginFormDataBuilder(this.store)
			.appendVersion(version)
			.appendFiles(version?.sources)
			.build();

		return this.http
			.post<IPluginVersion>(`${this.endPoint}/${pluginId}/versions`, formData, {
				reportProgress: true,
				observe: 'events'
			})
			.pipe(
				this.handleProgressResponse<IPluginVersion>(),
				map((res) => ({ ...res, version: res?.data }))
			);
	}

	public getVersions<T>(pluginId: ID, params: T): Observable<IPagination<IPluginVersion>> {
		return this.http.get<IPagination<IPluginVersion>>(`${this.endPoint}/${pluginId}/versions`, {
			params: toParams(params)
		});
	}

	public updateVersion(pluginId: string, versionId: string, version: IPluginVersion): Observable<IPluginVersion> {
		const formData = new PluginFormDataBuilder(this.store)
			.appendVersion(version)
			.appendFiles(version?.sources)
			.build();

		return this.http.put<IPluginVersion>(`${this.endPoint}/${pluginId}/versions/${versionId}`, formData);
	}

	public deleteVersion(pluginId: ID, versionId: ID): Observable<void> {
		return this.http.delete<void>(`${this.endPoint}/${pluginId}/versions/${versionId}`);
	}

	public restoreVersion(pluginId: ID, versionId: ID): Observable<void> {
		return this.http.patch<void>(`${this.endPoint}/${pluginId}/versions/${versionId}/status`, {
			status: 'restored'
		});
	}

	public getSources<T>(pluginId: ID, versionId: ID, params: T): Observable<IPagination<IPluginSource>> {
		return this.http.get<IPagination<IPluginSource>>(`${this.endPoint}/${pluginId}/versions/${versionId}/sources`, {
			params: toParams(params)
		});
	}

	public deleteSource(pluginId: ID, versionId: ID, sourceId: ID): Observable<void> {
		return this.http.delete<void>(`${this.endPoint}/${pluginId}/versions/${versionId}/sources/${sourceId}`);
	}

	public restoreSource(pluginId: ID, versionId: ID, sourceId: ID): Observable<void> {
		return this.http.patch<void>(`${this.endPoint}/${pluginId}/versions/${versionId}/sources/${sourceId}`, {
			deleted: false
		});
	}

	public addSources(
		pluginId: ID,
		versionId: ID,
		sources: IPluginSource[]
	): Observable<{ sources?: IPluginSource[]; progress?: number }> {
		const formData = new PluginFormDataBuilder(this.store)
			.appendSource(sources, 'sources')
			.appendFiles(sources)
			.build();

		return this.http
			.post<IPluginSource[]>(`${this.endPoint}/${pluginId}/versions/${versionId}/sources`, formData, {
				reportProgress: true,
				observe: 'events'
			})
			.pipe(
				this.handleProgressResponse<IPluginSource[]>(),
				map((res) => ({ ...res, sources: res?.data }))
			);
	}

	private handleProgressResponse<T>() {
		return (source: Observable<HttpEvent<T>>) => {
			return source.pipe(
				map((event: HttpEvent<T>) => {
					if (event.type === HttpEventType.UploadProgress) {
						return {
							data: null,
							progress: event.loaded / (event.total ?? event.loaded)
						};
					} else if (event instanceof HttpResponse) {
						return {
							data: event.body as T,
							progress: 1
						};
					}
				}),
				catchError((error) => {
					throw error;
				})
			);
		};
	}
}
