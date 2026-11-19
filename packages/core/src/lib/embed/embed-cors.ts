import type { CorsOptions, CorsOptionsDelegate } from '@nestjs/common/interfaces/external/cors-options.interface';
import { isEmbedRoute } from './embed-session';
import { normalizeOrigin } from './embed-origin';

/** What the CORS answer needs of the allowed origins: whether any organization allows one. */
export interface EmbedOriginLookup {
	isAllowedAnywhere(origin: string): Promise<boolean>;
}

/**
 * The public routes a site's page calls itself with the renewal token a person's sign-in gave it: the renewal and the
 * sign-out. The renewal answers only the site the token was issued for (`EmbedSiteGrantService.renew`).
 */
const EMBED_SITE_ROUTES: ReadonlyArray<RegExp> = [/^\/api\/embed\/renew\/?$/, /^\/api\/embed\/revoke\/?$/];

/** Whether a request reaches a route a site's page calls with a renewal token. The path is without its query string. */
function isEmbedSiteRoute(method: string, path: string): boolean {
	const isPost = String(method ?? '').toUpperCase() === 'POST';
	return isPost && EMBED_SITE_ROUTES.some((route) => route.test(path));
}

/**
 * CORS for ALLOWED_ORIGINS, plus the origins organizations allow to embed their timer, on two kinds of routes only: those
 * an embed token reaches, and those a site's page renews or ends a person's sign-in with (a preflight is judged by the
 * method it announces). Such an origin gets no credentials: the widget sends its tokens in a header or in the body. Any
 * other request is answered as before.
 */
export function createEmbedCorsDelegate(
	corsOptions: CorsOptions,
	allowedOrigins: string[],
	embedOrigins: EmbedOriginLookup
): CorsOptionsDelegate<any> {
	return (request: any, callback: (err: Error | null, options?: CorsOptions) => void) => {
		const origin = request.headers?.origin;
		if (!origin || allowedOrigins.includes(origin)) {
			callback(null, corsOptions);
			return;
		}
		let method = request.method;
		if (method === 'OPTIONS') {
			method = String(request.headers['access-control-request-method'] ?? '');
		}
		const path = String(request.path ?? request.url ?? '').split('?')[0];
		const normalized = normalizeOrigin(origin);
		const isEmbedPageRoute = isEmbedRoute(method, path) || isEmbedSiteRoute(method, path);
		if (!normalized || !isEmbedPageRoute) {
			callback(null, corsOptions);
			return;
		}
		embedOrigins.isAllowedAnywhere(normalized).then(
			(allowed) => {
				if (!allowed) {
					callback(null, corsOptions);
					return;
				}
				callback(null, { ...corsOptions, origin: true, credentials: false });
			},
			() => callback(null, corsOptions)
		);
	};
}
