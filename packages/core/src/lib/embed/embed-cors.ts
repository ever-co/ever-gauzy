import type { CorsOptions, CorsOptionsDelegate } from '@nestjs/common/interfaces/external/cors-options.interface';
import { isEmbedRoute } from './embed-session';
import { normalizeOrigin } from './embed-origin';

/** What the CORS answer needs of the allowed origins: whether any organization allows one. */
export interface EmbedOriginLookup {
	isAllowedAnywhere(origin: string): Promise<boolean>;
}

/**
 * CORS for ALLOWED_ORIGINS, plus the origins organizations allow to embed their timer, for the routes an embed token
 * reaches only (a preflight is judged by the method it announces). Such an origin gets no credentials: the widget
 * sends its token in the Authorization header. Any other request is answered as before.
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
		if (!normalized || !isEmbedRoute(method, path)) {
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
