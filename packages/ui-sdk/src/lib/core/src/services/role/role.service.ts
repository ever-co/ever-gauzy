import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom, Observable } from 'rxjs';
import { IRole, IPagination, IRoleCreateInput, IRoleFindInput } from '@gauzy/contracts';
import { API_PREFIX, toParams } from '@gauzy/ui-sdk/common';

@Injectable()
export class RoleService {
	constructor(private http: HttpClient) {}

	getRoleByOptions(options: IRoleFindInput): Observable<IRole> {
		return this.http.get<IRole>(`${API_PREFIX}/roles/options`, {
			params: toParams({ ...options })
		});
	}

	getAll(): Promise<IPagination<IRole>> {
		return firstValueFrom(this.http.get<IPagination<IRole>>(`${API_PREFIX}/roles`));
	}

	create(role: IRoleCreateInput): Observable<IRole> {
		return this.http.post<IRole>(`${API_PREFIX}/roles`, {
			...role
		});
	}

	delete(role: IRole): Observable<IRole> {
		return this.http.delete<IRole>(`${API_PREFIX}/roles/${role.id}`);
	}

	getRoleById(roleId: string): Promise<IRole> {
		return firstValueFrom(this.http.get<IRole>(`${API_PREFIX}/roles/${roleId}`));
	}
}
