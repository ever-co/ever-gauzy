import { environment } from './environment';

/**
 * Whether the API runs as a development instance: NODE_ENV=development on a non-production build.
 * Both checks are needed because NODE_ENV is a runtime setting while `environment.production`
 * is fixed at build time. Use it to keep developer-only diagnostics out of every instance that is
 * not started as a development one.
 */
export function isDevelopment(): boolean {
	return process.env.NODE_ENV === 'development' && !environment.production;
}
