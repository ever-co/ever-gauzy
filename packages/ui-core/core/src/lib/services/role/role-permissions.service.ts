import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import {
	ID,
	IPagination,
	IRolePermission,
	IRolePermissionCreateInput,
	IRolePermissionFindInput,
	IRolePermissionUpdateInput
} from '@gauzy/contracts';
import { API_PREFIX, toParams } from '@gauzy/ui-core/common';

@Injectable()
export class RolePermissionsService {
	constructor(private readonly http: HttpClient) {}

	/**
	 * Retrieves role permissions based on the specified filter criteria.
	 *
	 * @param {IRolePermissionFindInput} [where] - An optional filter object used to specify the criteria for retrieving role permissions.
	 * @returns {Promise<IPagination<IRolePermission>>} - Returns a promise that resolves to a pagination object containing the role permissions.
	 */
	getRolePermissions(where?: IRolePermissionFindInput): Promise<IPagination<IRolePermission>> {
		return firstValueFrom(
			this.http.get<IPagination<IRolePermission>>(`${API_PREFIX}/role-permissions`, {
				params: toParams({ where })
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
