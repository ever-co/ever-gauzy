import { BadRequestException, Controller, Header, Headers, HttpCode, HttpStatus, Inject, Logger, Post, Req, UnauthorizedException } from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { Request } from 'express';
import { Public } from '@gauzy/common';
import { LinearConfig } from './linear-config';
import { LinearTenantService } from './linear-tenant.service';
import { LINEAR_CONFIG, LINEAR_ROUTE_PREFIX, LINEAR_WEBHOOK_DEDUPE_MS, LINEAR_WEBHOOK_MAX_BYTES, LINEAR_WEBHOOK_TOLERANCE_MS } from './linear.constants';
import { LinearSyncService } from './sync/linear-sync.service';

type RawBodyRequest = Request & { rawBody?: Buffer };

/** The part of a Linear webhook delivery the integration reads. */
export interface LinearWebhookPayload {
	action: 'create' | 'update' | 'remove' | string;
	type: string;
	organizationId?: string;
	webhookTimestamp?: number;
	webhookId?: string;
	data?: { id?: string; teamId?: string; team?: { id?: string } };
}

/** Whether the delivery is what Linear signed: `Linear-Signature` is the hex HMAC-SHA256 of the raw body with the signing secret. */
export function isLinearSignatureValid(secret: string, rawBody: Buffer, signature: string | undefined): boolean {
	if (!signature || !/^[a-f0-9]{64}$/i.test(signature)) return false;
	const expected = createHmac('sha256', secret).update(rawBody).digest('hex');
	const given = Buffer.from(signature.toLowerCase(), 'hex');
	const wanted = Buffer.from(expected, 'hex');
	return given.length === wanted.length && timingSafeEqual(given, wanted);
}

/** Whether the delivery's own timestamp (milliseconds) is recent enough: a replay beyond the tolerance is refused. */
export function isLinearTimestampFresh(webhookTimestamp: number | undefined, now = Date.now(), toleranceMs = LINEAR_WEBHOOK_TOLERANCE_MS): boolean {
	return typeof webhookTimestamp === 'number' && Number.isFinite(webhookTimestamp) && Math.abs(now - webhookTimestamp) <= toleranceMs;
}

/**
 * `POST /integration/linear/webhook`: Linear's deliveries for the OAuth application. Public, so
 * everything rests on the signature over the raw bytes with the application's signing secret
 * (`LINEAR_WEBHOOK_SECRET`; no secret, no webhooks), on the delivery's timestamp, and on its id (a
 * retried delivery is applied once per process). The workspace in the payload names the connections it
 * concerns, never the tenant: each of them applies the issue through its own inbound mapping of the team.
 */
@ApiExcludeController()
@Public()
@Controller(LINEAR_ROUTE_PREFIX)
export class LinearWebhookController {
	private readonly logger = new Logger(LinearWebhookController.name);
	/** Delivery ids seen lately → when. */
	private readonly seen = new Map<string, number>();

	constructor(
		@Inject(LINEAR_CONFIG) private readonly config: LinearConfig,
		private readonly tenants: LinearTenantService,
		private readonly sync: LinearSyncService
	) {}

	@Post('/webhook')
	@HttpCode(HttpStatus.OK)
	@Header('Cache-Control', 'no-store')
	async receive(
		@Req() request: RawBodyRequest,
		@Headers('linear-signature') signature?: string,
		@Headers('linear-event') eventHeader?: string
	): Promise<{ accepted: boolean; applied: number; duplicate?: boolean }> {
		const secret = this.config.webhookSecret;
		if (!secret) throw new UnauthorizedException('Linear webhooks are not configured on this server.');
		const raw = request.rawBody;
		if (!Buffer.isBuffer(raw) || raw.length === 0) throw new BadRequestException('The raw request body is required.');
		if (raw.length > LINEAR_WEBHOOK_MAX_BYTES) throw new BadRequestException('The webhook body is too large.');
		if (!isLinearSignatureValid(secret, raw, signature)) throw new UnauthorizedException('Invalid or missing Linear webhook signature.');
		let payload: LinearWebhookPayload;
		try {
			payload = JSON.parse(raw.toString('utf8'));
		} catch {
			throw new BadRequestException('The webhook body is not JSON.');
		}
		if (!isLinearTimestampFresh(payload.webhookTimestamp)) throw new UnauthorizedException('The webhook timestamp is missing or too old.');
		if (payload.webhookId && this.isDuplicate(payload.webhookId)) return { accepted: true, applied: 0, duplicate: true };

		const type = payload.type || eventHeader || '';
		if (type !== 'Issue' || (payload.action !== 'create' && payload.action !== 'update')) {
			return { accepted: true, applied: 0 };
		}
		const issueId = payload.data?.id;
		const teamId = payload.data?.teamId ?? payload.data?.team?.id;
		const linearOrganizationId = payload.organizationId;
		if (!issueId || !teamId || !linearOrganizationId) return { accepted: true, applied: 0 };

		const tenants = await this.tenants.findByLinearOrganization(linearOrganizationId);
		let applied = 0;
		for (const tenant of tenants) {
			try {
				await this.sync.applyIssueFromWebhook(tenant, issueId, teamId);
				applied += 1;
			} catch (error) {
				this.logger.warn(`Webhook issue ${issueId} could not be applied for connection ${tenant.id}: ${error instanceof Error ? error.message : String(error)}`);
			}
		}
		return { accepted: true, applied };
	}

	private isDuplicate(webhookId: string): boolean {
		const now = Date.now();
		for (const [id, at] of this.seen) {
			if (now - at > LINEAR_WEBHOOK_DEDUPE_MS) this.seen.delete(id);
		}
		if (this.seen.has(webhookId)) return true;
		this.seen.set(webhookId, now);
		return false;
	}
}
