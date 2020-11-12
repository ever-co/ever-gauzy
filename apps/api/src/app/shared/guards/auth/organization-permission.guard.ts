import { environment as env } from '@env-api/environment';
import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { verify } from 'jsonwebtoken';
import { RequestContext } from '../../../core/context';
import { InjectRepository } from '@nestjs/typeorm';
import { Employee } from '../../../employee/employee.entity';
import { Repository } from 'typeorm';
import { RolesEnum } from '@gauzy/models';

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

			if (
				env.allowSuperAdminRole === true &&
				role === RolesEnum.SUPER_ADMIN
			) {
				return true;
			}

			const employee = await this.employeeRepository.findOne(employeeId, {
				relations: ['organization']
			});
			let organizationId: string;
			if (employeeId && employee.organization) {
				organizationId = employee.organization.id;
				isAuthorized =
					permissions.filter((p) => employee.organization[p]).length >
					0;
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
