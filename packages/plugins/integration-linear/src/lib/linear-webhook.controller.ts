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
	data?: { id?: string; teamId?: string; team?: { id?: string }; issueId?: string; issue?: { id?: string; teamId?: string; team?: { id?: string } } };
}

/**
 * The issue a delivery is about, and its team when the delivery says it: an issue created or updated names itself;
 * a comment or an attachment created or updated names the issue it belongs to (the issue is read again, and its
 * comments and attachments with it). Anything else — a removal, another type — is nothing to apply.
 */
export function issueOfDelivery(payload: Pick<LinearWebhookPayload, 'type' | 'action' | 'data'>): { issueId: string; teamId: string | null } | null {
	if (payload.action !== 'create' && payload.action !== 'update') return null;
	const data = payload.data;
	if (payload.type === 'Issue') {
		const issueId = data?.id;
		return issueId ? { issueId, teamId: data?.teamId ?? data?.team?.id ?? null } : null;
	}
	if (payload.type === 'Comment' || payload.type === 'Attachment') {
		const issueId = data?.issueId ?? data?.issue?.id;
		return issueId ? { issueId, teamId: data?.issue?.teamId ?? data?.issue?.team?.id ?? null } : null;
	}
	return null;
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
 * (`LINEAR_WEBHOOK_SECRET`; no secret, no webhooks) and on the delivery's timestamp. The delivery is
 * acknowledged as soon as those checks pass (Linear gives a receiver five seconds); the issue is then
 * applied behind the response, through every connection of the workspace the payload names (never a
 * tenant), each by its own inbound mapping of the team. A delivery (`Linear-Delivery`) is remembered once
 * every connection applied it, so a retry does nothing; one that failed is not, and the next import reads
 * the issue again anyway (a webhook never moves the import watermark).
 */
@ApiExcludeController()
@Public()
@Controller(LINEAR_ROUTE_PREFIX)
export class LinearWebhookController {
	private readonly logger = new Logger(LinearWebhookController.name);
	/** Delivery ids applied lately → when. */
	private readonly applied = new Map<string, number>();

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
		@Headers('linear-event') eventHeader?: string,
		@Headers('linear-delivery') deliveryId?: string
	): Promise<{ accepted: boolean; queued: boolean; duplicate?: boolean }> {
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
		const delivery = typeof deliveryId === 'string' && deliveryId.trim() ? deliveryId.trim().slice(0, 128) : null;
		if (delivery && this.wasApplied(delivery)) return { accepted: true, queued: false, duplicate: true };

		const about = issueOfDelivery({ ...payload, type: payload.type || eventHeader || '' });
		const linearOrganizationId = payload.organizationId;
		if (!about || !linearOrganizationId) return { accepted: true, queued: false };
		const { issueId, teamId } = about;

		// Answered now; applied behind the response (reading the issue and writing the task may take longer than
		// Linear waits for a receiver).
		setImmediate(() => {
			this.apply(linearOrganizationId, issueId, teamId, delivery).catch((error: unknown) => {
				this.logger.warn(`Webhook issue ${issueId} could not be applied: ${error instanceof Error ? error.message : String(error)}`);
			});
		});
		return { accepted: true, queued: true };
	}

	private async apply(linearOrganizationId: string, issueId: string, teamId: string | null, delivery: string | null): Promise<void> {
		const tenants = await this.tenants.findByLinearOrganization(linearOrganizationId);
		const failures: string[] = [];
		for (const tenant of tenants) {
			const outcome = await this.sync.applyIssueFromWebhook(tenant, issueId, teamId);
			if (outcome.error) failures.push(`${tenant.id}: ${outcome.error}`);
		}
		if (failures.length) {
			// Not remembered: a retry of the delivery is applied again, and the next import reads the issue anyway.
			this.logger.warn(`Webhook issue ${issueId} failed for ${failures.length} connection(s): ${failures.join('; ')}`);
			return;
		}
		if (delivery) this.remember(delivery);
	}

	private wasApplied(delivery: string): boolean {
		const now = Date.now();
		for (const [id, at] of this.applied) {
			if (now - at > LINEAR_WEBHOOK_DEDUPE_MS) this.applied.delete(id);
		}
		return this.applied.has(delivery);
	}

	private remember(delivery: string): void {
		this.applied.set(delivery, Date.now());
	}
}
