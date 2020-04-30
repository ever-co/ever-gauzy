import { environment as env } from '@env-api/environment';
import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { verify } from 'jsonwebtoken';
import { RequestContext } from '../../../core/context';
import { InjectRepository } from '@nestjs/typeorm';
import { Employee } from '../../../employee/employee.entity';
import { Repository } from 'typeorm';

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

			const { id, employeeId } = verify(token, env.JWT_SECRET) as {
				id: string;
				role: string;
				employeeId: string;
			};

			const employee = await this.employeeRepository.findOne(employeeId, {
				relations: ['organization']
			});

			if (employeeId && employee.organization) {
				isAuthorized =
					permissions.filter((p) => employee.organization[p]).length >
					0;
			}

			if (!isAuthorized) {
				console.log(
					'Unauthorized access blocked. UserId:',
					id,
					' Permissions Checked:',
					permissions
				);
			}
		}

		return isAuthorized;
	}
}
