import { HttpClient, HttpEvent, HttpEventType, HttpResponse } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { ID, IPagination, IPlugin, IPluginVersion, PluginSourceType } from '@gauzy/contracts';
import { API_PREFIX, toParams } from '@gauzy/ui-core/common';
import { catchError, map, Observable } from 'rxjs';
import { Store } from '../../../services';

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

	private createFormData(data: Partial<IPlugin>): FormData {
		const common = { organizationId: this.store.organizationId, tenantId: this.store.tenantId };

		// Strictly map all properties of ICreatePlugin and IUpdatePlugin
		const plugin = {
			...(data.id && { id: data.id }),
			name: data.name,
			description: data.description,
			type: data.type,
			status: data.status,
			author: data.author,
			license: data.license,
			homepage: data.homepage,
			repository: data.repository,
			...common,
			version: data.version
				? {
						...(data.version.id && { id: data.version.id }),

						number: data.version.number,
						changelog: data.version.changelog,
						releaseDate: this.toISOString(data.version.releaseDate),
						...common,
						source: data.version.source
							? {
									...(data.version.source.id && { id: data.version.source.id }),
									type: data.version.source.type,
									...(data.version.source.type === PluginSourceType.CDN && {
										url: data.version.source.url,
										integrity: data.version.source.integrity,
										crossOrigin: data.version.source.crossOrigin
									}),
									...(data.version.source.type === PluginSourceType.NPM && {
										name: data.version.source.name,
										registry: data.version.source.registry,
										authToken: data.version.source.authToken,
										scope: data.version.source.scope
									}),
									...common
							  }
							: undefined // Source details
				  }
				: undefined // Current version
		};

		// Remove undefined values to avoid sending empty fields
		const filtered = Object.fromEntries(Object.entries(plugin).filter(([_, value]) => value !== undefined));

		// Append plugin data as JSON
		const formData = this.jsonToFormData(filtered);

		// Extract and append the file from `source.file` (if available)
		const file = data.version.source && 'file' in data.version.source ? data.version.source.file : undefined;
		if (file instanceof File) {
			formData.append('file', file, file.name);
		}

		return formData;
	}

	private toISOString(value: Date | string) {
		return new Date(value).toISOString();
	}

	public buildFormData<T>(formData: FormData, data: T, parentKey?: string) {
		if (data && typeof data === 'object' && !(data instanceof Date) && !(data instanceof File)) {
			Object.keys(data).forEach((key) => {
				this.buildFormData(formData, data[key], parentKey ? `${parentKey}[${key}]` : key);
			});
		} else {
			const value = data == null ? '' : data;
			formData.append(parentKey, value as any);
		}
	}

	public jsonToFormData<T>(data: T) {
		const formData = new FormData();
		this.buildFormData(formData, data);
		return formData;
	}

	public upload(plugin: IPlugin): Observable<{ plugin?: IPlugin; progress?: number }> {
		return this.http
			.post<IPlugin>(this.endPoint, this.createFormData(plugin), {
				reportProgress: true,
				observe: 'events'
			})
			.pipe(
				map((event: HttpEvent<IPlugin>) => {
					if (event.type === HttpEventType.UploadProgress) {
						return { plugin: null, progress: event.loaded / (event.total ?? event.loaded) };
					} else if (event instanceof HttpResponse) {
						return { plugin: event.body, progress: 1 };
					}
				}),
				catchError((error) => {
					throw error;
				})
			);
	}

	public update(pluginId: ID, plugin: Partial<IPlugin>): Observable<IPlugin> {
		const formData = this.createFormData(plugin);
		return this.http.put<IPlugin>(`${this.endPoint}/${pluginId}`, formData);
	}

	public delete(id: string): Observable<IPlugin> {
		return this.http.delete<IPlugin>(`${this.endPoint}/${id}`);
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

	public install({ pluginId, versionId }: { pluginId: string; versionId: string }): Observable<void> {
		return this.http.patch<void>(`${this.endPoint}/${pluginId}/install`, null, { params: toParams({ versionId }) });
	}

	public uninstall(pluginId: string): Observable<void> {
		return this.http.patch<void>(`${this.endPoint}/${pluginId}/uninstall`, null);
	}

	public activate(pluginId: string): Observable<void> {
		return this.http.patch<void>(`${this.endPoint}/${pluginId}/activate`, null);
	}

	public deactivate(pluginId: string): Observable<void> {
		return this.http.patch<void>(`${this.endPoint}/${pluginId}/deactivate`, null);
	}

	private createVersionFormData(data: IPluginVersion): FormData {
		const common = { organizationId: this.store.organizationId, tenantId: this.store.tenantId };

		// Strictly map all properties of ICreatePlugin and IUpdatePlugin
		const version = {
			...(data.id && { id: data.id }),
			number: data.number,
			changelog: data.changelog,
			releaseDate: this.toISOString(data.releaseDate),
			...common,
			source: data.source
				? {
						...(data.source.id && { id: data.source.id }),
						type: data.source.type,
						...(data.source.type === PluginSourceType.CDN && {
							url: data.source.url,
							integrity: data.source.integrity,
							crossOrigin: data.source.crossOrigin
						}),
						...(data.source.type === PluginSourceType.NPM && {
							name: data.source.name,
							registry: data.source.registry,
							authToken: data.source.authToken,
							scope: data.source.scope
						}),
						...common
				  }
				: undefined // Source details
		};

		// Remove undefined values to avoid sending empty fields
		const filtered = Object.fromEntries(Object.entries(version).filter(([_, value]) => value !== undefined));

		// Append plugin data as JSON
		const formData = this.jsonToFormData(filtered);

		// Extract and append the file from `source.file` (if available)
		const file = data.source && 'file' in data.source ? data.source.file : undefined;
		if (file instanceof File) {
			formData.append('file', file, file.name);
		}

		return formData;
	}

	public addVersion(
		pluginId: string,
		version: IPluginVersion
	): Observable<{ version?: IPluginVersion; progress?: number }> {
		return this.http
			.post<IPluginVersion>(`${this.endPoint}/${pluginId}/versions`, this.createVersionFormData(version), {
				reportProgress: true,
				observe: 'events'
			})
			.pipe(
				map((event: HttpEvent<IPluginVersion>) => {
					if (event.type === HttpEventType.UploadProgress) {
						return { version: null, progress: event.loaded / (event.total ?? event.loaded) };
					} else if (event instanceof HttpResponse) {
						return { version: event.body, progress: 1 };
					}
				}),
				catchError((error) => {
					throw error;
				})
			);
	}

	public getVersions<T>(pluginId: ID, params: T): Observable<IPagination<IPluginVersion>> {
		return this.http.get<IPagination<IPluginVersion>>(`${this.endPoint}/${pluginId}/versions`, {
			params: toParams(params)
		});
	}
	public updateVersion(pluginId: string, versionId: string, version: IPluginVersion): Observable<IPluginVersion> {
		return this.http.put<IPluginVersion>(
			`${this.endPoint}/${pluginId}/versions/${versionId}`,
			this.createVersionFormData(version)
		);
	}

	public deleteVersion(pluginId: ID, versionId: ID): Observable<void> {
		return this.http.delete<void>(`${this.endPoint}/${pluginId}/versions/${versionId}`);
	}

	public restoreVersion(pluginId: ID, versionId: ID): Observable<void> {
		return this.http.post<void>(`${this.endPoint}/${pluginId}/versions/${versionId}`, {});
	}
}
