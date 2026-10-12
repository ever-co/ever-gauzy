import { CanActivate, ExecutionContext, HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { Request, Response } from 'express';

/** A bounded, per-process limit before credential lookup, independent of optional global throttling. */
@Injectable()
export class EverAsyncRateLimitGuard implements CanActivate {
	private readonly clients = new Map<string, { resetAt: number; remaining: number }>();
	private readonly capacity = 5000;
	private readonly windowMs = 60_000;
	private readonly limit = this.configuredLimit();

	private configuredLimit(): number {
		const configured = Number(process.env['EVER_ASYNC_CONNECTOR_REQUESTS_PER_MINUTE']);
		return Number.isInteger(configured) && configured > 0 && configured <= 50_000 ? configured : 600;
	}

	canActivate(context: ExecutionContext): boolean {
		const http = context.switchToHttp();
		const request = http.getRequest<Request>();
		const response = http.getResponse<Response>();
		// Gauzy trusts all forwarding headers, so only the socket peer is safe before authentication.
		// Requests through the same reverse proxy share this configurable per-process budget.
		const client = request.socket.remoteAddress || 'unknown';
		const now = Date.now();
		let bucket = this.clients.get(client);
		if (!bucket || bucket.resetAt <= now) {
			for (const [key, value] of this.clients) {
				if (value.resetAt <= now) this.clients.delete(key);
			}
			if (this.clients.size >= this.capacity) {
				const oldestClient = this.clients.keys().next().value;
				if (oldestClient !== undefined) this.clients.delete(oldestClient);
			}
			bucket = { resetAt: now + this.windowMs, remaining: this.limit };
			this.clients.set(client, bucket);
		}
		if (bucket.remaining <= 0) return this.refuse(response, Math.ceil((bucket.resetAt - now) / 1000));
		bucket.remaining--;
		return true;
	}

	private refuse(response: Response, seconds: number): never {
		response.setHeader('Retry-After', Math.max(seconds, 1));
		throw new HttpException('Too many connector requests. Retry later.', HttpStatus.TOO_MANY_REQUESTS);
	}
}
