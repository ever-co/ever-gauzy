/**
 * What the PostHog interceptors and middleware may send about a request.
 *
 * Headers and keys used to be redacted only when their name was exactly `authorization`, `cookie` or `api-key`, or
 * exactly `password`, `token`, `secret`, `credit_card` or `ssn`; and the URL went out as it came. So the tenant
 * `X-API-KEY`, a `confirmPassword`, `newPassword`, `refresh_token`, `access_token`, `id_token`, a sign-in `code`, a
 * Zitadel `handoff`, and every `?token=` a third-party integration route takes reached PostHog with every error and
 * every tracked request.
 */
export class SanitizerUtil {
	/** Request and response headers that carry a credential. */
	private static readonly sensitiveHeaders = new Set([
		'authorization',
		'proxy-authorization',
		'cookie',
		'set-cookie',
		'api-key',
		'x-api-key',
		'x-auth-token',
		'x-cart-token'
	]);

	/** Keys redacted wherever they appear in a name, `confirmPassword`, `refresh_token` and `clientSecret` alike. */
	private static readonly sensitiveFragments = ['password', 'passwd', 'secret', 'token', 'apikey', 'privatekey'];

	/** Keys redacted when they are the whole name: a one-time code, a hash, a card number. */
	private static readonly sensitiveNames = new Set([
		'code',
		'otp',
		'pin',
		'hash',
		'signature',
		'handoff',
		'ticket',
		'jwt',
		'creditcard',
		'cardnumber',
		'cvv',
		'cvc',
		'ssn'
	]);

	/**
	 * Whether a key names a credential or a secret: compared without case, `-` or `_`, so `refresh_token`,
	 * `refreshToken` and `Refresh-Token` are the same name.
	 */
	static isSensitiveKey(key: string): boolean {
		const name = String(key)
			.toLowerCase()
			.replace(/[^a-z0-9]/g, '');
		return this.sensitiveNames.has(name) || this.sensitiveFragments.some((fragment) => name.includes(fragment));
	}

	static sanitizeHeaders(headers: Record<string, any>): Record<string, any> {
		const sanitized = { ...headers };
		for (const key of Object.keys(sanitized)) {
			if (this.sensitiveHeaders.has(key.toLowerCase())) {
				sanitized[key] = '[REDACTED]';
			}
		}
		return sanitized;
	}

	static sanitizeObject(obj: any): any {
		if (!obj || typeof obj !== 'object') return obj;
		if (Array.isArray(obj)) return obj.map((item) => this.sanitizeObject(item));

		const result = { ...obj };
		for (const key in result) {
			if (this.isSensitiveKey(key)) {
				result[key] = '[REDACTED]';
			} else if (typeof result[key] === 'object') {
				result[key] = this.sanitizeObject(result[key]);
			}
		}
		return result;
	}

	/**
	 * A URL (a path with its query, or an absolute URL such as a referrer) with every sensitive query value
	 * replaced by `[REDACTED]`; the rest is kept as it was.
	 */
	static sanitizeUrl(url: string | undefined): string | undefined {
		if (typeof url !== 'string') return url;
		const at = url.indexOf('?');
		if (at === -1) return url;

		const hash = url.indexOf('#', at);
		const query = url.slice(at + 1, hash === -1 ? undefined : hash);
		const params = new URLSearchParams(query);
		let changed = false;
		for (const name of [...new Set(params.keys())]) {
			if (this.isSensitiveKey(name)) {
				params.set(name, '[REDACTED]');
				changed = true;
			}
		}
		if (!changed) return url;
		return `${url.slice(0, at)}?${params.toString()}${hash === -1 ? '' : url.slice(hash)}`;
	}
}
