import { CanActivate, ExecutionContext, ForbiddenException, Inject, Injectable } from '@nestjs/common';
import { EVER_CONNECT_LAUNCHER_SETTINGS, LauncherConfig, originOf } from './launcher-config';

/** The header value of a request (the first one when it was sent twice). */
function header(
	request: { headers?: Record<string, string | string[] | undefined> },
	name: string
): string | undefined {
	const value = request?.headers?.[name];
	return Array.isArray(value) ? value[0] : value;
}

/**
 * The App Launcher's routes answer only the web apps they are meant for: a request's `Origin` must be one of
 * `EVER_APP_LAUNCHER_ORIGINS` (by default the web app's own origin, from `CLIENT_BASE_URL`); a request without an
 * `Origin` passes only when the browser marks it `Sec-Fetch-Site: same-origin`. Anything else gets 403
 * `origin_not_allowed`, before any read is made.
 */
@Injectable()
export class LauncherOriginGuard implements CanActivate {
	constructor(@Inject(EVER_CONNECT_LAUNCHER_SETTINGS) private readonly config: LauncherConfig) {}

	canActivate(context: ExecutionContext): boolean {
		const request = context.switchToHttp().getRequest();
		const origin = header(request, 'origin');
		let allowed: boolean;
		if (origin !== undefined) {
			// `null` (an opaque origin) and anything that is not an origin are refused.
			const normalized = originOf(origin);
			allowed = normalized !== null && this.config.origins.includes(normalized);
		} else {
			allowed = header(request, 'sec-fetch-site') === 'same-origin';
		}
		if (!allowed) {
			throw new ForbiddenException({ statusCode: 403, error: 'Forbidden', code: 'origin_not_allowed' });
		}
		return true;
	}
}
