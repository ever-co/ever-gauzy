import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import {
	IRolePermission,
	IRolePermissionCreateInput,
	IRolePermissionUpdateInput
} from '@gauzy/contracts';
import { first } from 'rxjs/operators';

@Injectable()
export class RolePermissionsService {
	constructor(private http: HttpClient) {}

	getRolePermissions(
		findInput?: any
	): Promise<{ items: IRolePermission[]; total: number }> {
		const data = JSON.stringify({ findInput });
		return this.http
			.get<any>(`/api/role-permissions`, {
				params: { data }
			})
			.pipe(first())
			.toPromise();
	}

	create(createInput: IRolePermissionCreateInput): Promise<IRolePermission> {
		return this.http
			.post<IRolePermission>('/api/role-permissions', createInput)
			.pipe(first())
			.toPromise();
	}

	update(id: string, updateInput: IRolePermissionUpdateInput): Promise<any> {
		return this.http
			.put(`/api/role-permissions/${id}`, updateInput)
			.pipe(first())
			.toPromise();
	}
}
