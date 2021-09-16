import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { IRole, RolesEnum, ITenant, IPagination } from '@gauzy/contracts';
import { Observable } from 'rxjs';
import { first } from 'rxjs/operators';
import { API_PREFIX } from '../constants/app.constants';

@Injectable()
export class RoleService {
	constructor(private http: HttpClient) {}

	getRoleByName(findInput?: {
		name: RolesEnum;
		tenantId: ITenant['id'];
	}): Observable<IRole> {
		const data = JSON.stringify({ findInput });
		return this.http.get<IRole>(`${API_PREFIX}/role/find`, {
			params: { data }
		});
	}

	getAll(): Promise<IPagination<IRole>> {
		return this.http
			.get<IPagination<IRole>>(`${API_PREFIX}/role`)
			.pipe(first())
			.toPromise();
	}

	getRoleById(roleId: string): Promise<IRole> {
		return this.http
			.get<IRole>(`${API_PREFIX}/role/${roleId}`)
			.pipe(first())
			.toPromise();
	}
}
