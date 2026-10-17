import {
	CanActivate,
	Controller,
	ExecutionContext,
	Header,
	HttpCode,
	HttpException,
	HttpStatus,
	Injectable,
	Param,
	Post,
	Req,
	UseGuards
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public } from '@gauzy/common';
import { INBOX_INBOUND_ROUTE } from '../inbox-email.constants';
import { IInboundWebhookRequest } from '../providers/email-provider.types';
import { getInboxEmailConfig } from './inbox-email.config';
import { InboxInboundService } from './inbox-inbound.service';

/** The request fields the webhook reads (Express's request, without depending on its types). */
interface InboundHttpRequest {
	headers?: Record<string, string | string[] | undefined>;
	body?: unknown;
	rawBody?: Buffer;
	query?: Record<string, unknown>;
	originalUrl?: string;
	url?: string;
	/** The client address Express resolves (it honours the platform's `trust proxy` setting). */
	ip?: string;
	socket?: { remoteAddress?: string };
}

/**
 * A per-client-address bucket on the provider webhook (`GAUZY_INBOX_INBOUND_REQUESTS_PER_MINUTE`, default 600).
 * Keyed on the client address Express resolves (forwarding headers only through the proxies the platform trusts, so
 * a proxy in front of the API is not one shared bucket); excess requests get 429 with `Retry-After`.
 */
@Injectable()
export class InboxInboundRateLimitGuard implements CanActivate {
	private readonly buckets = new Map<string, { count: number; resetAt: number }>();

	canActivate(context: ExecutionContext): boolean {
		const request = context.switchToHttp().getRequest<InboundHttpRequest>();
		const response = context.switchToHttp().getResponse<{ setHeader?: (name: string, value: string) => void }>();
		const limit = getInboxEmailConfig().inboundRequestsPerMinute;
		// The client address Express resolves through the trusted proxies (the platform configures them), else the peer.
		const key = request?.ip || request?.socket?.remoteAddress || 'unknown';
		const now = Date.now();
		if (this.buckets.size > 50_000) {
			for (const [address, bucket] of this.buckets) if (bucket.resetAt <= now) this.buckets.delete(address);
		}
		const bucket = this.buckets.get(key);
		if (!bucket || bucket.resetAt <= now) {
			this.buckets.set(key, { count: 1, resetAt: now + 60_000 });
			return true;
		}
		bucket.count += 1;
		if (bucket.count > limit) {
			response?.setHeader?.('Retry-After', String(Math.max(1, Math.ceil((bucket.resetAt - now) / 1000))));
			throw new HttpException('Too many requests.', HttpStatus.TOO_MANY_REQUESTS);
		}
		return true;
	}
}

/**
 * `POST /api/inbox/inbound/:providerId/:accountId` (plan 04 §3, §5.3): the provider webhook. `@Public()` — a provider
 * has no Gauzy credential; the account's own secret proves the request (`provider.inbound.verify`), and the platform
 * route `/inbound/generic/platform` is proven with `GAUZY_INBOX_PLATFORM_SECRET`. Unknown providers and accounts answer
 * 404, unproven requests 401, and a stored delivery 202 with `{ accepted, duplicates, dropped }`.
 *
 * The signature is computed over the raw body, which the API captures for every JSON and URL-encoded form request,
 * and this route's own middleware for a multipart form or a `text/plain` body (`InboundRawBodyMiddleware`).
 */
@ApiTags('Inbox')
@Public()
@UseGuards(InboxInboundRateLimitGuard)
@Controller(INBOX_INBOUND_ROUTE)
export class InboxInboundController {
	constructor(private readonly inbound: InboxInboundService) {}

	@Post('/:providerId/:accountId')
	@HttpCode(HttpStatus.ACCEPTED)
	@Header('Cache-Control', 'no-store')
	@ApiOperation({ summary: 'An email provider delivers mail for a provider account (signed by that account).' })
	receive(
		@Param('providerId') providerId: string,
		@Param('accountId') accountId: string,
		@Req() request: InboundHttpRequest
	) {
		const webhook: IInboundWebhookRequest = {
			headers: Object.fromEntries(
				Object.entries(request?.headers ?? {}).map(([name, value]) => [name.toLowerCase(), value])
			),
			body: request?.body ?? {},
			...(Buffer.isBuffer(request?.rawBody) ? { rawBody: request.rawBody } : {}),
			query: request?.query ?? {},
			url: String(request?.originalUrl ?? request?.url ?? '')
		};
		return this.inbound.receive(String(providerId).slice(0, 32), String(accountId).slice(0, 64), webhook);
	}
}
