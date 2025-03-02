import { ExecutionContext, Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

@Injectable()
export class AuthRefreshGuard extends AuthGuard('jwt-refresh-token') {
	/**
	 * Determines if the current request can proceed by invoking the base class's `canActivate` method.
	 * This is used to enforce authentication and authorization logic defined in the extended class.
	 *
	 * @param context - The execution context of the request, providing access to details such as the request object and route metadata.
	 * @returns A boolean or a Promise resolving to `true` if the request is authorized, otherwise throws an exception.
	 * @throws `UnauthorizedException` if the authentication fails or the user lacks the necessary permissions.
	 */
	canActivate(context: ExecutionContext) {
		return super.canActivate(context);
	}
}
