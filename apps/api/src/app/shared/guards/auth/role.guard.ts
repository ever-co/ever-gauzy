import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RequestContext } from '../../../core/context';
import { AuthService } from '../../../auth';

@Injectable()
export class RoleGuard implements CanActivate {
	constructor(
		private readonly _reflector: Reflector,
		private readonly _authService: AuthService
	) {}

	async canActivate(context: ExecutionContext): Promise<boolean> {
		const roles = this._reflector.get<string[]>(
			'roles',
			context.getClass()
		);

		let isAuthorized = false;

		if (!roles) {
			isAuthorized = true;
		} else {
			const token = RequestContext.currentToken();
			isAuthorized = await this._authService.hasRole(token, roles);
		}

		return isAuthorized;
	}
}
