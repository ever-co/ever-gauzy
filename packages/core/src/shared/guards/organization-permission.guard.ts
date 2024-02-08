import { environment as env } from '@gauzy/config';
import { CanActivate, ExecutionContext, Injectable, Type } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { verify } from 'jsonwebtoken';
import { PermissionsEnum, RolesEnum } from '@gauzy/contracts';
import { isEmpty, PERMISSIONS_METADATA, removeDuplicates } from '@gauzy/common';
import * as camelCase from 'camelcase';
import { RequestContext } from './../../core/context';
import { EmployeeService } from '../../employee/employee.service';

@Injectable()
export class OrganizationPermissionGuard implements CanActivate {
	constructor(
		readonly _reflector: Reflector,
		readonly _employeeService: EmployeeService
	) {
		console.log({ _employeeService }, 'OrganizationPermissionGuard');
	}

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
		const { id, role, employeeId } = verify(token, env.JWT_SECRET) as {
			id: string;
			role: string;
			employeeId: string;
		};

		// Check if super admin role is allowed from the .env file
		if (env.allowSuperAdminRole && RequestContext.hasRoles([RolesEnum.SUPER_ADMIN])) {
			return true;
		}

		// Check permissions based on user role
		if (role === RolesEnum.EMPLOYEE) {
			const employee = await this._employeeService.findOneByIdString(employeeId, {
				relations: { organization: true }
			});

			// Check employee details and organization permissions
			if (employee && employee.organization) {
				const { organization } = employee;

				// Check if the organization has the required permissions
				return permissions.some((permission) => organization[camelCase(permission)]);
			}
		} else {
			// For non-employee roles, consider it authorized
			return true;
		}

		// Log unauthorized access attempts
		console.log(`Unauthorized access blocked: User ID: ${id}, Role: ${role}, Employee ID: ${employeeId}, Permissions Checked: ${permissions.join(', ')}`);

		return false;
	}
}
