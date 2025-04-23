export class SanitizerUtil {
	private static readonly sensitiveFields = ['password', 'token', 'secret', 'credit_card', 'ssn'];

	private static readonly sensitiveHeaders = ['authorization', 'cookie', 'api-key'];

	static sanitizeHeaders(headers: Record<string, any>): Record<string, any> {
		const sanitized = { ...headers };
		for (const header of this.sensitiveHeaders) {
			const headerLower = header.toLowerCase();
			for (const key in sanitized) {
				if (key.toLowerCase() === headerLower) {
					sanitized[key] = '[REDACTED]';
				}
			}
		}
		return sanitized;
	}

	static sanitizeObject(obj: any): any {
		if (!obj || typeof obj !== 'object') return obj;
		if (Array.isArray(obj)) return obj.map((item) => this.sanitizeObject(item));

		const result = { ...obj };
		for (const key in result) {
			if (this.sensitiveFields.includes(key.toLowerCase())) {
				result[key] = '[REDACTED]';
			} else if (typeof result[key] === 'object') {
				result[key] = this.sanitizeObject(result[key]);
			}
		}
		return result;
	}
}
