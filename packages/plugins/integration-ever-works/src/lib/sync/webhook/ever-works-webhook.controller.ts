import {
	BadRequestException,
	Controller,
	Header,
	Headers,
	HttpCode,
	HttpStatus,
	Logger,
	NotFoundException,
	Param,
	Post,
	Req,
	UnauthorizedException,
	UseGuards
} from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import { isUUID } from 'class-validator';
import { DataSource } from 'typeorm';
import { Request } from 'express';
import { Public } from '@gauzy/common';
import { verifyWebhookSignature } from '@gauzy/core';
import { EverWorksConnection } from '../../connection/ever-works-connection.entity';
import { EverWorksConnectionService } from '../../connection/ever-works-connection.service';
import { EVER_WORKS_ROUTE_PREFIX } from '../../ever-works.constants';
import { EverWorksEnvelopeError, parseEverWorksEnvelope } from '../inbound/ever-works-envelope';
import { EverWorksInboundStore } from '../inbound/ever-works-inbound.store';
import { EverWorksRateLimitGuard } from './ever-works-rate-limit.guard';

type RawBodyRequest = Request & { rawBody?: Buffer };

/** The largest webhook body accepted (one event per delivery; the feed carries anything bigger). */
export const EVER_WORKS_WEBHOOK_MAX_BYTES = 1024 * 1024;

/**
 * `POST /api/integration/ever-works/webhooks/:connectionId` (plan 02 §4, 03 §B.5): Ever Works webhooks
 * v2. Public (no Gauzy user), so everything rests on the signature:
 *
 * - the per-process rate limit runs first, before any lookup;
 * - the connection is loaded by the id in the path, and the tenant and organization come from it and
 *   from its mapping, **never from the payload** (an envelope for another Ever Works tenant is refused);
 * - `X-Ever-Works-Signature` (`t=<unix>,v1=<hex HMAC-SHA256(secret, "<t>.<raw body>")>`, 300 s
 *   tolerance) is verified over the raw bytes with the connection's own secret, with Gauzy's
 *   `verifyWebhookSignature`; there is no unsigned mode;
 * - the event is stored once (deduplicated on its id), answered 202, and applied asynchronously.
 *
 * Every refusal is a 4xx, which Ever Works does not retry; only a failure to store is a 5xx.
 */
@ApiExcludeController()
@Public()
@UseGuards(EverWorksRateLimitGuard)
@Controller(`${EVER_WORKS_ROUTE_PREFIX}/webhooks`)
export class EverWorksWebhookController {
	private readonly logger = new Logger('EverWorksWebhook');

	constructor(
		private readonly dataSource: DataSource,
		private readonly connections: EverWorksConnectionService,
		private readonly inbound: EverWorksInboundStore
	) {}

	@Post('/:connectionId')
	@HttpCode(HttpStatus.ACCEPTED)
	@Header('Cache-Control', 'no-store')
	async receive(
		@Param('connectionId') connectionId: string,
		@Req() request: RawBodyRequest,
		@Headers('x-ever-works-signature') signature?: string,
		@Headers('x-ever-works-event-id') eventIdHeader?: string
	): Promise<{ accepted: true; duplicate: boolean }> {
		if (!isUUID(connectionId)) throw new NotFoundException();
		const connection = await this.dataSource.getRepository(EverWorksConnection).findOne({ where: { id: connectionId, isActive: true } });
		if (!connection) throw new NotFoundException();
		const raw = request.rawBody;
		if (!Buffer.isBuffer(raw) || raw.length === 0) throw new BadRequestException('The raw request body is required.');
		if (raw.length > EVER_WORKS_WEBHOOK_MAX_BYTES) throw new BadRequestException('The webhook body is too large.');
		const secret = this.connections.webhookSecret(connection);
		const body = raw.toString('utf8');
		if (!secret || !signature || !verifyWebhookSignature(secret, body, signature)) {
			throw new UnauthorizedException('Invalid or missing Ever Works webhook signature.');
		}
		let envelope;
		try {
			envelope = parseEverWorksEnvelope(JSON.parse(body));
		} catch (error) {
			throw new BadRequestException(error instanceof EverWorksEnvelopeError ? error.message : 'The webhook body is not JSON.');
		}
		if (envelope.tenantId !== connection.ewTenantId) {
			this.logger.warn(`Connection ${connection.id}: a signed event names another Ever Works tenant; refused.`);
			throw new BadRequestException('The event belongs to another Ever Works tenant.');
		}
		if (eventIdHeader && eventIdHeader !== envelope.id) throw new BadRequestException('X-Ever-Works-Event-Id does not match the event.');
		const { duplicate } = await this.inbound.record(connection, envelope, 'webhook');
		// Only a hint for the feed poller's cadence; a lost update costs one extra poll.
		void this.dataSource
			.getRepository(EverWorksConnection)
			.update({ id: connection.id }, { lastWebhookAt: new Date() } as never)
			.catch(() => undefined);
		return { accepted: true, duplicate };
	}
}
