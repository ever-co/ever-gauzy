import { ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthGuard as PassportAuthGaurd } from '@nestjs/passport';

@Injectable()
export class AuthGuard extends PassportAuthGaurd('jwt') {
	constructor(
		private readonly _reflector: Reflector
	) {
		super();
	}

	canActivate(context: ExecutionContext) {
		const isPublic = this._reflector.get<boolean>(
			'isPublic',
			context.getHandler()
		);

		if (isPublic) {
			return true;
		}

		// Make sure to check the authorization, for now, just return false to have a difference between public routes.
		return super.canActivate(context);
	}
}