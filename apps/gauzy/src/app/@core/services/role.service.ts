import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { IRole, RolesEnum, ITenant } from '@gauzy/contracts';
import { Observable } from 'rxjs';
import { first } from 'rxjs/operators';

@Injectable()
export class RoleService {
	constructor(private http: HttpClient) {}

	getRoleByName(findInput?: {
		name: RolesEnum;
		tenantId: ITenant['id'];
	}): Observable<IRole> {
		const data = JSON.stringify({ findInput });
		return this.http.get<IRole>(`/api/role`, {
			params: { data }
		});
	}

	getRoleById(roleId: string): Promise<IRole> {
		return this.http
			.get<IRole>(`/api/role/${roleId}`)
			.pipe(first())
			.toPromise();
	}
}
