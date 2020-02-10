import { environment as env } from '@env-api/environment';
import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { InjectRepository } from '@nestjs/typeorm';
import { verify } from 'jsonwebtoken';
import { Repository } from 'typeorm';
import { RequestContext } from '../../../core/context';
import { User } from '../../../user';

@Injectable()
export class PermissionGuard implements CanActivate {
	userRepository: Repository<User>;

	constructor(
		private readonly _reflector: Reflector,
		@InjectRepository(User) userRepository: Repository<User>
	) {
		this.userRepository = userRepository;
	}

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

			const user = await this.userRepository.find({
				where: { id },
				relations: ['role', 'role.rolePermissions']
			});

			isAuthorized = !!user[0].role.rolePermissions.find(
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
