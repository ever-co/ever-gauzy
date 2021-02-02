import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import {
	IRolePermission,
	IRolePermissionCreateInput,
	IRolePermissionUpdateInput
} from '@gauzy/contracts';
import { first } from 'rxjs/operators';
import { API_PREFIX } from '../constants/app.constants';

@Injectable()
export class RolePermissionsService {
	constructor(private http: HttpClient) {}

	getRolePermissions(
		findInput?: any
	): Promise<{ items: IRolePermission[]; total: number }> {
		const data = JSON.stringify({ findInput });
		return this.http
			.get<any>(`${API_PREFIX}/role-permissions`, {
				params: { data }
			})
			.pipe(first())
			.toPromise();
	}

	create(createInput: IRolePermissionCreateInput): Promise<IRolePermission> {
		return this.http
			.post<IRolePermission>(
				`${API_PREFIX}/role-permissions`,
				createInput
			)
			.pipe(first())
			.toPromise();
	}

	update(id: string, updateInput: IRolePermissionUpdateInput): Promise<any> {
		return this.http
			.put(`${API_PREFIX}/role-permissions/${id}`, updateInput)
			.pipe(first())
			.toPromise();
	}
}
