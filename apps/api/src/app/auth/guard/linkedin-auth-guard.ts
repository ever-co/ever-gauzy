import { Injectable, ExecutionContext } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import passport from 'passport';
import { Observable } from 'rxjs';

@Injectable()
export class LinkedinAuthGuard extends AuthGuard('linkedin') {
	canActivate(
		context: ExecutionContext
	): boolean | Promise<boolean> | Observable<boolean> {
		const request = context.switchToHttp().getRequest();
		const baseUrl = request.headers.referer;
		const { roleName } = request.query;

		this.setPassportSession(roleName, baseUrl);
		return super.canActivate(context);
	}

	private setPassportSession(roleName: string, baseUrl: string) {
		const client_url = passport['_strategies'].session.client_url;
		const role_name = passport['_strategies'].session.role_name;

		if (!client_url) {
			passport['_strategies'].session.client_url = baseUrl
				.slice(0, baseUrl.lastIndexOf('/'))
				.toString();
		}

		if (role_name) {
			passport['_strategies'].session.role_name = roleName;
		}
	}
}
