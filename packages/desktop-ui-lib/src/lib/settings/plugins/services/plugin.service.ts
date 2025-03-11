import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { IPlugin } from '@gauzy/contracts';
import { API_PREFIX } from '@gauzy/ui-core/common';
import { Observable } from 'rxjs';

@Injectable({
	providedIn: 'root'
})
export class PluginService {
	private readonly endPoint = `${API_PREFIX}/plugins`;

	constructor(private readonly http: HttpClient) {}

	public getAll(): Observable<IPlugin[]> {
		return this.http.get<IPlugin[]>(this.endPoint);
	}

	public getOne(id: string): Observable<IPlugin> {
		return this.http.get<IPlugin>(`${this.endPoint}/${id}`);
	}

	public upload(plugin: IPlugin): Observable<IPlugin> {
		return this.http.post<IPlugin>(this.endPoint, plugin);
	}

	public update(plugin: IPlugin): Observable<IPlugin> {
		return this.http.put<IPlugin>(`${this.endPoint}/${plugin.id}`, plugin);
	}

	public delete(id: string): Observable<IPlugin> {
		return this.http.delete<IPlugin>(`${this.endPoint}/${id}`);
	}

	public verify(plugin: IPlugin): Observable<IPlugin> {
		return this.http.post<IPlugin>(`${this.endPoint}/verify`, plugin);
	}
}
