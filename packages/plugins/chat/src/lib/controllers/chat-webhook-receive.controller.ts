import { Body, Controller, Headers, HttpCode, Param, Post, Req, Res } from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import type { Request, Response } from 'express';
import { Public } from '@gauzy/common';
import { CHAT_ROUTE_PREFIX } from '../chat.constants';
import { ChatWebhookService } from '../webhooks/chat-webhook.service';

type RawBodyRequest = Request & { rawBody?: Buffer };

/**
 * `POST /api/chat/hooks/:token`: a sender's post to a channel through its incoming webhook. Public: the URL secret in
 * the path is the credential (looked up through its SHA-256), and everything else follows from the webhook row — the
 * tenant, the organization, the channel. Answers a plain-text code a sender can match on:
 *
 * - `200 ok` — posted (or the same `nonce` / `Idempotency-Key` was posted before: nothing new);
 * - `404 no_webhook` — unknown or revoked URL, webhooks off (`GAUZY_CHAT_WEBHOOKS_ENABLED`), chat off for the tenant;
 * - `410 channel_is_archived`;
 * - `422 invalid_payload` · `payload_too_large` (over 64 KiB) · `too_many_blocks` (over 50) · `invalid_blocks` · `no_text`;
 * - `429 rate_limited`, with `Retry-After` in seconds.
 *
 * The platform's per-client throttler applies as on every route; the per-webhook and per-organization limits are
 * the webhook service's.
 */
@ApiExcludeController()
@Public()
@Controller(CHAT_ROUTE_PREFIX)
export class ChatWebhookReceiveController {
	constructor(private readonly webhooks: ChatWebhookService) {}

	@Post('/hooks/:token')
	@HttpCode(200)
	async receive(
		@Param('token') token: string,
		@Body() body: unknown,
		@Headers('idempotency-key') idempotencyKey: string | undefined,
		@Req() request: RawBodyRequest,
		@Res() response: Response
	): Promise<void> {
		// The bytes as received (the platform keeps them for signature checks); without them, what the sender declared.
		const rawLength = request.rawBody?.length ?? (Number(request.headers['content-length']) || 0);
		const receipt = await this.webhooks.receive(token, body, rawLength, idempotencyKey ?? null);
		response.setHeader('Cache-Control', 'no-store');
		if (receipt.status === 429) response.setHeader('Retry-After', String(receipt.retryAfterSeconds));
		response.status(receipt.status).type('text/plain; charset=utf-8').send(receipt.body);
	}
}
