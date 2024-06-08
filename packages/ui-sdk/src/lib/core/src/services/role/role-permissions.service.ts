import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { IRolePermission, IRolePermissionCreateInput, IRolePermissionUpdateInput } from '@gauzy/contracts';
import { API_PREFIX } from '@gauzy/ui-sdk/common';
import { firstValueFrom } from 'rxjs';

@Injectable()
export class RolePermissionsService {
	constructor(private readonly http: HttpClient) {}

	getRolePermissions(findInput?: any): Promise<{ items: IRolePermission[]; total: number }> {
		const data = JSON.stringify({ findInput });
		return firstValueFrom(
			this.http.get<any>(`${API_PREFIX}/role-permissions`, {
				params: { data }
			})
		);
	}

	create(createInput: IRolePermissionCreateInput): Promise<IRolePermission> {
		return firstValueFrom(this.http.post<IRolePermission>(`${API_PREFIX}/role-permissions`, createInput));
	}

	update(id: string, updateInput: IRolePermissionUpdateInput): Promise<any> {
		return firstValueFrom(this.http.put(`${API_PREFIX}/role-permissions/${id}`, updateInput));
	}
}
