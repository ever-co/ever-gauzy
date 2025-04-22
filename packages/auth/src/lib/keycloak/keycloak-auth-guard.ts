import { Injectable, ExecutionContext } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Observable } from 'rxjs';
import passport from 'passport';

@Injectable()
export class KeycloakAuthGuard extends AuthGuard('keycloak') {
	/**
	 * Determines whether a request should be allowed based on session data.
	 *
	 * @param context - The execution context containing the incoming request.
	 * @returns A boolean, a Promise of a boolean, or an Observable of a boolean.
	 */
	canActivate(context: ExecutionContext): boolean | Promise<boolean> | Observable<boolean> {
		const request = context.switchToHttp().getRequest();
		const baseUrl: string = request.headers.referer;
		const { roleName } = request.query;

		this.setPassportSession(roleName, baseUrl);
		return super.canActivate(context);
	}

	/**
	 * Sets the session configuration for Passport by updating the client URL and role name.
	 *
	 * @param roleName - The role name retrieved from the request query.
	 * @param baseUrl - The base URL extracted from the request headers.
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
