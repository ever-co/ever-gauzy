import { environment as env } from '@gauzy/config';
import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { InjectRepository } from '@nestjs/typeorm';
import { verify } from 'jsonwebtoken';
import { Repository } from 'typeorm';
import { RolesEnum } from '@gauzy/contracts';
import * as camelCase from 'camelcase';
import { RequestContext } from './../../core/context';
import { Employee } from './../../core/entities/internal';

@Injectable()
export class OrganizationPermissionGuard implements CanActivate {
	constructor(
		private readonly _reflector: Reflector,

		@InjectRepository(Employee)
		private readonly employeeRepository: Repository<Employee>
	) {}

	async canActivate(context: ExecutionContext): Promise<boolean> {
		const permissions = this._reflector.get<string[]>(
			'permissions',
			context.getHandler()
		);

		let isAuthorized = false;
		if (!permissions) {
			isAuthorized = true;
		} else {
			const token = RequestContext.currentToken();
			const { employeeId, role } = verify(token, env.JWT_SECRET) as {
				id: string;
				role: string;
				employeeId: string;
			};

			//Enabled AllowSuperAdminRole from .env file
			if (env.allowSuperAdminRole === true) {
				//Super admin and admin has allowed to access request
				const isSuperAdmin = RequestContext.hasRoles([
					RolesEnum.SUPER_ADMIN
				]);
				if (isSuperAdmin === true) {
					isAuthorized = isSuperAdmin;
					return isAuthorized;
				}
			}

			let organizationId: string;
			if  (role === RolesEnum.EMPLOYEE) {
				const employee = await this.employeeRepository.findOne(employeeId, {
					relations: ['organization']
				});
				if (employeeId && employee.organization) {
					const { organization } = employee;
					organizationId = organization.id;
					isAuthorized = permissions.filter((permission) => organization[camelCase(permission)]).length > 0;
				}
			} else {
				isAuthorized = true;
			}

			if (!isAuthorized) {
				console.log(
					'Unauthorized access blocked. OrganizationId:',
					organizationId,
					' Permissions Checked:',
					permissions
				);
			}
		}

		return isAuthorized;
	}
}
