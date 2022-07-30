import { environment as env } from '@gauzy/config';
import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { verify } from 'jsonwebtoken';
import { removeDuplicates } from '@gauzy/common';
import { RequestContext } from './../../core/context';
import { UserService } from './../../user/user.service';

@Injectable()
export class PermissionGuard implements CanActivate {
	constructor(
		private readonly _reflector: Reflector,
		private readonly userService: UserService
	) {}

	async canActivate(context: ExecutionContext): Promise<boolean> {
		/*
		* GET metadata permissions class method level
		*/
		const methodPermissions = this._reflector.get<string[]>(
			'permissions',
			context.getHandler()
		) || [];

		/*
		* GET metadata permissions class level
		*/
		const classPermissions = this._reflector.get<string[]>(
			'permissions',
			context.getClass()
		) || [];

		const permissions = removeDuplicates(methodPermissions.concat(classPermissions));

		let isAuthorized = false;
		if (permissions.length === 0) {
			isAuthorized = true;
		} else {
			const token = RequestContext.currentToken();

			const { id } = verify(token, env.JWT_SECRET) as {
				id: string;
				role: string;
			};

			const user = await this.userService.findOneByIdString(id, {
				relations: {
					role: {
						rolePermissions: true
					}
				}
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
