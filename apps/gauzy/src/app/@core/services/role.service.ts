import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { IRole, RolesEnum, ITenant, IPagination } from '@gauzy/contracts';
import { firstValueFrom, Observable } from 'rxjs';
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
		return firstValueFrom(
			this.http
			.get<IPagination<IRole>>(`${API_PREFIX}/role`)
		);
	}

	getRoleById(roleId: string): Promise<IRole> {
		return firstValueFrom(
			this.http
			.get<IRole>(`${API_PREFIX}/role/${roleId}`)
		);
	}
}
