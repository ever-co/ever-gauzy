import { CanActivate, ExecutionContext, HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { Request, Response } from 'express';

/**
 * A bounded, per-process limit on the public webhook route before any lookup (the
 * `EverAsyncRateLimitGuard` pattern), independent of optional global throttling. Keyed on the socket
 * peer: Gauzy trusts forwarding headers, so only the peer is safe before authentication. The default,
 * 1200 requests a minute, is adjustable with `EVER_WORKS_WEBHOOK_REQUESTS_PER_MINUTE` (1–50 000).
 */
@Injectable()
export class EverWorksRateLimitGuard implements CanActivate {
	private readonly clients = new Map<string, { resetAt: number; remaining: number }>();
	private readonly capacity = 5000;
	private readonly windowMs = 60_000;
	private readonly limit = EverWorksRateLimitGuard.configuredLimit(process.env);

	static configuredLimit(env: Record<string, string | undefined>): number {
		const configured = Number(env['EVER_WORKS_WEBHOOK_REQUESTS_PER_MINUTE']);
		return Number.isInteger(configured) && configured > 0 && configured <= 50_000 ? configured : 1200;
	}

	canActivate(context: ExecutionContext): boolean {
		const http = context.switchToHttp();
		const request = http.getRequest<Request>();
		const response = http.getResponse<Response>();
		const client = request.socket?.remoteAddress || 'unknown';
		const now = Date.now();
		let bucket = this.clients.get(client);
		if (!bucket || bucket.resetAt <= now) {
			for (const [key, value] of this.clients) {
				if (value.resetAt <= now) this.clients.delete(key);
			}
			if (this.clients.size >= this.capacity) {
				const oldest = this.clients.keys().next().value;
				if (oldest !== undefined) this.clients.delete(oldest);
			}
			bucket = { resetAt: now + this.windowMs, remaining: this.limit };
			this.clients.set(client, bucket);
		}
		if (bucket.remaining <= 0) {
			response.setHeader('Retry-After', Math.max(Math.ceil((bucket.resetAt - now) / 1000), 1));
			throw new HttpException('Too many Ever Works webhook requests. Retry later.', HttpStatus.TOO_MANY_REQUESTS);
		}
		bucket.remaining--;
		return true;
	}
}
