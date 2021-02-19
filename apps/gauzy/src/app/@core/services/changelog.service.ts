import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { IChangelog } from '@gauzy/contracts';
import { UntilDestroy } from '@ngneat/until-destroy';
import { API_PREFIX } from '../constants/app.constants';
import { Service } from './service';

@UntilDestroy()
@Injectable({
	providedIn: 'root'
})
export class ChangelogService extends Service<IChangelog> {
	constructor(protected http: HttpClient) {
		super({ http, basePath: `${API_PREFIX}/changelog/all` });
	}

	getAll(): Promise<{ items: IChangelog[] }> {
		return this.http
			.get<{ items: IChangelog[] }>(`${this.basePath}`)
			.pipe()
			.toPromise();
	}
}
