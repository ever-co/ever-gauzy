import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import {
	ID,
	IPagination,
	IRolePermission,
	IRolePermissionCreateInput,
	IRolePermissionUpdateInput
} from '@gauzy/contracts';
import { API_PREFIX } from '@gauzy/ui-core/common';

@Injectable()
export class RolePermissionsService {
	constructor(private readonly http: HttpClient) {}

	/**
	 * Retrieves a list of role permissions based on the provided filter criteria.
	 *
	 * @param findInput - Optional filter criteria for retrieving role permissions.
	 * @returns A promise that resolves to an object containing the list of role permissions (`items`) and the total count (`total`).
	 */
	getRolePermissions(findInput?: any): Promise<IPagination<IRolePermission>> {
		const data = JSON.stringify(findInput);
		return firstValueFrom(
			this.http.get<IPagination<IRolePermission>>(`${API_PREFIX}/role-permissions`, {
				params: { data }
			})
		);
	}

	/**
	 * Creates a new role permission.
	 *
	 * @param input - The input data for creating the role permission.
	 * @returns A promise that resolves to the created role permission.
	 */
	create(input: IRolePermissionCreateInput): Promise<IRolePermission> {
		return firstValueFrom(this.http.post<IRolePermission>(`${API_PREFIX}/role-permissions`, input));
	}

	/**
	 * Updates an existing role permission.
	 *
	 * @param id - The ID of the role permission to update.
	 * @param input - The input data for updating the role permission.
	 * @returns A promise that resolves to the updated role permission.
	 */
	update(id: ID, input: IRolePermissionUpdateInput): Promise<IRolePermission> {
		return firstValueFrom(this.http.put<IRolePermission>(`${API_PREFIX}/role-permissions/${id}`, input));
	}
}
