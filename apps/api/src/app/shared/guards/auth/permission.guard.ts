import { environment as env } from '@env-api/environment';
import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { verify } from 'jsonwebtoken';
import { RequestContext } from '../../../core/context';
import { UserService } from '../../../user';
@Injectable()
export class PermissionGuard implements CanActivate {
	constructor(
		private readonly _reflector: Reflector,
		private readonly userService: UserService
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

			const { id } = verify(token, env.JWT_SECRET) as {
				id: string;
				role: string;
			};

			const user = await this.userService.findOne(id, {
				relations: ['role', 'role.rolePermissions']
			});

			isAuthorized = !!user.role.rolePermissions.find(
				(p) => permissions.indexOf(p.permission) > -1 && p.enabled
			);

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
