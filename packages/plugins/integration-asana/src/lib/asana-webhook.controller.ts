import { BadRequestException, Controller, ForbiddenException, Header, Headers, HttpCode, HttpStatus, Logger, NotFoundException, Param, Post, Query, Req, Res, UnauthorizedException } from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { Request, Response } from 'express';
import { isUUID } from 'class-validator';
import { ID } from '@gauzy/contracts';
import { Public } from '@gauzy/common';
import { AsanaMappingService } from './asana-mapping.service';
import { AsanaTenantService } from './asana-tenant.service';
import { ASANA_ROUTE_PREFIX, ASANA_WEBHOOK_HANDSHAKE_WINDOW_MS, ASANA_WEBHOOK_MAX_BYTES } from './asana.constants';
import { AsanaProjectMapping } from './entities/asana-project-mapping.entity';
import { AsanaSyncService } from './sync/asana-sync.service';

type RawBodyRequest = Request & { rawBody?: Buffer };

/** One event of an Asana delivery. */
export interface AsanaWebhookEvent {
	action: 'added' | 'changed' | 'removed' | 'deleted' | 'undeleted' | string;
	resource?: { gid?: string; resource_type?: string; resource_subtype?: string } | null;
	parent?: { gid?: string; resource_type?: string } | null;
	created_at?: string;
}

/** Whether the delivery is what Asana signed: `X-Hook-Signature` is the hex HMAC-SHA256 of the raw body with the hook's secret. */
export function isAsanaSignatureValid(secret: string, rawBody: Buffer, signature: string | undefined): boolean {
	if (!signature || !/^[a-f0-9]{64}$/i.test(signature)) return false;
	const expected = createHmac('sha256', secret).update(rawBody).digest('hex');
	const given = Buffer.from(signature.toLowerCase(), 'hex');
	const wanted = Buffer.from(expected, 'hex');
	return given.length === wanted.length && timingSafeEqual(given, wanted);
}

/**
 * Whether a handshake may set the mapping's secret: only the one of a registration this platform started — its
 * single-use token in the address, within the registration's window. An unsolicited handshake (anyone who knows a
 * mapping id can send `X-Hook-Secret`) is refused, so nobody can replace the secret and sign deliveries.
 */
export function isHandshakeAccepted(
	mapping: Pick<AsanaProjectMapping, 'webhookHandshakeToken' | 'webhookHandshakeStartedAt'>,
	token: string | undefined,
	now: number = Date.now()
): boolean {
	const expected = mapping.webhookHandshakeToken;
	if (!expected || !token || !mapping.webhookHandshakeStartedAt) return false;
	const started = new Date(mapping.webhookHandshakeStartedAt).getTime();
	if (!Number.isFinite(started) || now - started > ASANA_WEBHOOK_HANDSHAKE_WINDOW_MS || started - now > 60_000) return false;
	const given = Buffer.from(token);
	const wanted = Buffer.from(expected);
	return given.length === wanted.length && timingSafeEqual(given, wanted);
}

/** The gids of the tasks a delivery's events concern (added, changed or undeleted), each once. */
export function taskGidsOf(events: AsanaWebhookEvent[] | undefined): string[] {
	const gids = new Set<string>();
	for (const event of events ?? []) {
		if (!event || !['added', 'changed', 'undeleted'].includes(event.action)) continue;
		const type = event.resource?.resource_type;
		// A task's own event names the task; a comment's or an attachment's names the task it belongs to (its parent).
		const gid = type === 'task' ? event.resource?.gid : (type === 'story' || type === 'attachment') && event.parent?.resource_type === 'task' ? event.parent.gid : null;
		if (gid) gids.add(gid);
	}
	return [...gids];
}

/**
 * `POST /integration/asana/webhook/:mappingId`: Asana's deliveries for one mapping's project. Public, so
 * everything rests on the mapping named in the path and on Asana's own scheme: the first call is the handshake
 * (`X-Hook-Secret`, answered back as the same header), which gives the mapping the secret every later delivery
 * is signed with (`X-Hook-Signature`, the HMAC-SHA256 of the raw body). The handshake is accepted only while a
 * registration started by this platform is in flight, and only with that registration's token in the address
 * (`?handshake=`). A delivery is acknowledged as soon as the signature checks (Asana waits a few seconds), then
 * the tasks its events name are applied behind the response. Nothing in the payload picks the tenant: the
 * mapping does.
 */
@ApiExcludeController()
@Public()
@Controller(`${ASANA_ROUTE_PREFIX}/webhook`)
export class AsanaWebhookController {
	private readonly logger = new Logger(AsanaWebhookController.name);

	constructor(
		private readonly mappings: AsanaMappingService,
		private readonly tenants: AsanaTenantService,
		private readonly sync: AsanaSyncService
	) {}

	@Post('/:mappingId')
	@HttpCode(HttpStatus.OK)
	@Header('Cache-Control', 'no-store')
	async receive(
		@Param('mappingId') mappingId: string,
		@Req() request: RawBodyRequest,
		@Res({ passthrough: true }) response: Response,
		@Headers('x-hook-secret') hookSecret?: string,
		@Headers('x-hook-signature') signature?: string,
		@Query('handshake') handshakeToken?: string
	): Promise<{ accepted: boolean; queued: number }> {
		if (!isUUID(mappingId)) throw new NotFoundException();
		const mapping = await this.mappings.findAnyById(mappingId as ID);
		if (!mapping) throw new NotFoundException();

		// The handshake: Asana sends the secret once, when the webhook is created, and expects it echoed. Only the
		// handshake of the registration in flight (its token, its window) may set it; the token is spent on success.
		if (typeof hookSecret === 'string' && hookSecret.trim()) {
			if (!isHandshakeAccepted(mapping, typeof handshakeToken === 'string' ? handshakeToken : undefined)) {
				throw new ForbiddenException('No webhook registration is in flight for this mapping.');
			}
			const secret = hookSecret.trim().slice(0, 255);
			await this.mappings.recordWebhook(mapping, { gid: mapping.webhookGid ?? null, secret });
			await this.mappings.startHandshake(mapping, null);
			response.setHeader('X-Hook-Secret', secret);
			return { accepted: true, queued: 0 };
		}

		const raw = request.rawBody;
		if (!Buffer.isBuffer(raw) || raw.length === 0) throw new BadRequestException('The raw request body is required.');
		if (raw.length > ASANA_WEBHOOK_MAX_BYTES) throw new BadRequestException('The webhook body is too large.');
		if (!mapping.webhookSecret || !isAsanaSignatureValid(mapping.webhookSecret, raw, signature)) {
			throw new UnauthorizedException('Invalid or missing Asana webhook signature.');
		}
		let payload: { events?: AsanaWebhookEvent[] };
		try {
			payload = JSON.parse(raw.toString('utf8'));
		} catch {
			throw new BadRequestException('The webhook body is not JSON.');
		}
		const taskGids = taskGidsOf(payload.events);
		if (!taskGids.length) return { accepted: true, queued: 0 };

		const tenant = await this.tenants.findAnyById(mapping.integrationId);
		if (!tenant) return { accepted: true, queued: 0 };
		// Answered now; applied behind the response.
		setImmediate(() => {
			this.sync.applyTasksFromWebhook(tenant, mapping, taskGids).catch((error: unknown) => {
				this.logger.warn(`Webhook tasks of mapping ${mapping.id} could not be applied: ${error instanceof Error ? error.message : String(error)}`);
			});
		});
		return { accepted: true, queued: taskGids.length };
	}
}
