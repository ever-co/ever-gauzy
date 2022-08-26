import { environment as env } from '@gauzy/config';
import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { verify } from 'jsonwebtoken';
import { isEmpty, PERMISSIONS_METADATA, removeDuplicates } from '@gauzy/common';
import { RequestContext } from './../../core/context';
import { UserService } from './../../user/user.service';
import { PermissionsEnum } from '@gauzy/contracts';

@Injectable()
export class PermissionGuard implements CanActivate {
	constructor(
		private readonly _reflector: Reflector,
		private readonly userService: UserService
	) {}

	async canActivate(context: ExecutionContext): Promise<boolean> {
		let isAuthorized = false;
		/*
		* Retrieve metadata for a specified key for a specified set of permissions
		*/
		const permissions = removeDuplicates(this._reflector.getAllAndOverride<PermissionsEnum[]>(PERMISSIONS_METADATA, [
			context.getHandler(),
			context.getClass(),
		])) || [];
		if (isEmpty(permissions)) {
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
