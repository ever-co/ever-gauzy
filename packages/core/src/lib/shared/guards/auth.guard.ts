import { ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthGuard as PassportAuthGuard } from '@nestjs/passport';
import { PUBLIC_METHOD_METADATA } from '@gauzy/common';

@Injectable()
export class AuthGuard extends PassportAuthGuard('jwt') {
	constructor(private readonly _reflector: Reflector) {
		super();
	}

	/**
	 * Determines if the current request can be activated based on authorization and PUBLIC decorators.
	 * @param context The execution context of the request.
	 * @returns A boolean indicating whether access is allowed.
	 */
	canActivate(context: ExecutionContext) {
		console.log('AuthGuard canActivate called');

		const request = context.switchToHttp().getRequest();

		// Allow preflight requests to pass without Auth
		if (request.method === 'OPTIONS') {
			return true;
		}

		// Check if the class has a PUBLIC decorator
		const isClassPublic = this._reflector.get<boolean>(PUBLIC_METHOD_METADATA, context.getClass());

		// Check if the method has a PUBLIC decorator
		const isMethodPublic = this._reflector.get<boolean>(PUBLIC_METHOD_METADATA, context.getHandler());

		// Allow access if the method or class has the PUBLIC decorator
		if (isClassPublic || isMethodPublic) {
			return true;
		}

		// For non-public methods or classes, check the authorization
		return super.canActivate(context);
	}
}
