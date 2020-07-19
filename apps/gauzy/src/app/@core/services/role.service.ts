import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Role, RolesEnum, ITenant } from '@gauzy/models';
import { Observable } from 'rxjs';
import { first } from 'rxjs/operators';

@Injectable()
export class RoleService {
	constructor(private http: HttpClient) {}

	getRoleByName(findInput?: {
		name: RolesEnum;
		tenant: ITenant;
	}): Observable<Role> {
		const data = JSON.stringify({ findInput });
		return this.http.get<Role>(`/api/role`, {
			params: { data }
		});
	}

	getRoleById(roleId: string): Promise<Role> {
		return this.http
			.get<Role>(`/api/role/${roleId}`)
			.pipe(first())
			.toPromise();
	}
}
