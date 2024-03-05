import { environment as env } from '@gauzy/config';
import { CanActivate, ExecutionContext, Injectable, Type } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { verify } from 'jsonwebtoken';
import { isEmpty, PERMISSIONS_METADATA, removeDuplicates } from '@gauzy/common';
import { PermissionsEnum } from '@gauzy/contracts';
import { RequestContext } from './../../core/context';
import { RolePermissionService } from '../../role-permission/role-permission.service';

@Injectable()
export class PermissionGuard implements CanActivate {
	constructor(
		private readonly _reflector: Reflector,
		private readonly _rolePermissionService: RolePermissionService
	) { }

	/**
	 * Checks if the user is authorized based on specified permissions.
	 * @param context The execution context.
	 * @returns A promise that resolves to a boolean indicating authorization status.
	 */
	async canActivate(context: ExecutionContext): Promise<boolean> {
		// Retrieve permissions from metadata
		const targets: Array<Function | Type<any>> = [context.getHandler(), context.getClass()];
		const permissions = removeDuplicates(this._reflector.getAllAndOverride<PermissionsEnum[]>(PERMISSIONS_METADATA, targets)) || [];

		// If no specific permissions are required, consider it authorized
		if (isEmpty(permissions)) {
			return true;
		}

		// Check user authorization
		const token = RequestContext.currentToken();
		const { id, role } = verify(token, env.JWT_SECRET) as { id: string; role: string };

		// Check if user has the required permissions
		const isAuthorized = await this._rolePermissionService.checkRolePermission(permissions, true);

		// Log unauthorized access attempts
		if (!isAuthorized) {
			// Log unauthorized access attempts
			console.log(`Unauthorized access blocked: User ID: ${id}, Role: ${role}, Permissions Checked: ${permissions.join(', ')}`);
		}

		return isAuthorized;
	}
}
