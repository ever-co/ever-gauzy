import { Injectable, ExecutionContext } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Observable } from 'rxjs';
import passport from 'passport';

@Injectable()
export class MicrosoftAuthGuard extends AuthGuard('microsoft') {
	/**
	 * Determines whether the current request is allowed.
	 *
	 * @param context - The execution context for the incoming request.
	 * @returns A boolean, Promise<boolean>, or Observable<boolean> indicating whether access is granted.
	 */
	canActivate(context: ExecutionContext): boolean | Promise<boolean> | Observable<boolean> {
		const request = context.switchToHttp().getRequest();
		const baseUrl: string = request.headers.referer;
		const { roleName } = request.query;

		this.setPassportSession(roleName, baseUrl);
		return super.canActivate(context);
	}

	/**
	 * Sets session-related properties for Passport.
	 *
	 * @param roleName - The role name from the request query.
	 * @param baseUrl - The referer URL from which the client URL is derived.
	 */
	private setPassportSession(roleName: string, baseUrl: string): void {
		const client_url = passport['_strategies'].session.client_url;
		const role_name = passport['_strategies'].session.role_name;

		if (!client_url) {
			passport['_strategies'].session.client_url = baseUrl.slice(0, baseUrl.lastIndexOf('/')).toString();
		}

		if (role_name) {
			passport['_strategies'].session.role_name = roleName;
		}
	}
}
