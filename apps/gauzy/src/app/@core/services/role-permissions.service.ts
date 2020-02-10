import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import {
	RolePermissions,
	RolePermissionsCreateInput,
	RolePermissionsUpdateInput
} from '@gauzy/models';
import { first } from 'rxjs/operators';

@Injectable()
export class RolePermissionsService {
	constructor(private http: HttpClient) {}

	getRolePermissions(
		findInput?: any
	): Promise<{ items: RolePermissions[]; total: number }> {
		const data = JSON.stringify({ findInput });
		return this.http
			.get<any>(`/api/role-permissions`, {
				params: { data }
			})
			.pipe(first())
			.toPromise();
	}

	create(createInput: RolePermissionsCreateInput): Promise<RolePermissions> {
		return this.http
			.post<RolePermissions>('/api/role-permissions', createInput)
			.pipe(first())
			.toPromise();
	}

	update(id: string, updateInput: RolePermissionsUpdateInput): Promise<any> {
		return this.http
			.put(`/api/role-permissions/${id}`, updateInput)
			.pipe(first())
			.toPromise();
	}
}
