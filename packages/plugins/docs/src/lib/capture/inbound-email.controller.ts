import { Body, Controller, HttpCode, HttpStatus, Post, Req } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Public } from '@gauzy/common';
import { IInboundEmailResponse, InboundEmailService } from './inbound-email.service';
import { IInboundWebhookRequest } from './inbound-email.types';

/**
 * `POST /api/plugins/docs/inbound-email` — the provider-agnostic inbound-email capture
 * webhook (`07-ai-knowledge.md` §17.2).
 *
 * Why it is `@Public()`: an ESP has no Gauzy JWT. Authentication is the **webhook
 * signature** (verified by the bound adapter before anything else is read) plus the
 * **per-organization recipient token**, and the whole route is inert unless
 * `GAUZY_DOCS_INBOUND_EMAIL_ENABLED=true` — a disabled deployment answers 404 to every
 * call, so nothing is exposed by default.
 *
 * All gate ordering, size caps, attachments-only enforcement and the
 * `EMAIL` + `PENDING(manual)` + never-auto-indexed landing state live in
 * `InboundEmailService` — this controller only adapts Express to the transport-neutral
 * request shape the adapters consume.
 */
@ApiTags('Documents Plugin')
@Public()
@Controller('/plugins/docs')
export class InboundEmailController {
	constructor(private readonly inboundEmailService: InboundEmailService) {}

	/**
	 * Accepts one inbound message from the configured mail provider.
	 */
	@ApiOperation({ summary: 'Inbound-email capture webhook (signed, per-organization token).' })
	@ApiResponse({ status: HttpStatus.OK, description: 'The message was processed (per-attachment results).' })
	@ApiResponse({ status: HttpStatus.FORBIDDEN, description: 'Invalid signature or failed SPF/DKIM.' })
	@ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'Channel disabled or unknown capture address.' })
	@ApiResponse({ status: HttpStatus.PAYLOAD_TOO_LARGE, description: 'The message exceeded the inbound size cap.' })
	@HttpCode(HttpStatus.OK)
	@Post('/inbound-email')
	public async receive(@Req() request: any, @Body() body: any): Promise<IInboundEmailResponse> {
		const webhookRequest: IInboundWebhookRequest = {
			headers: (request?.headers ?? {}) as Record<string, string | string[] | undefined>,
			body,
			// Present only when the HTTP layer preserves the raw payload; the reference
			// adapter documents the canonical-JSON fallback used when it is absent.
			rawBody: request?.rawBody
		};
		return this.inboundEmailService.handleWebhook(webhookRequest);
	}
}
