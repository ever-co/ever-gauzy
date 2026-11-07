import { BadRequestException, Controller, Head, Header, Headers, HttpCode, HttpStatus, Inject, Logger, NotFoundException, Param, Post, Req, UnauthorizedException } from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { Request } from 'express';
import { isUUID } from 'class-validator';
import { ID } from '@gauzy/contracts';
import { Public } from '@gauzy/common';
import { TrelloConfig, trelloWebhookTargetOf } from './trello-config';
import { TrelloMappingService } from './trello-mapping.service';
import { TrelloTenantService } from './trello-tenant.service';
import { TRELLO_CONFIG, TRELLO_ROUTE_PREFIX, TRELLO_WEBHOOK_MAX_BYTES } from './trello.constants';
import { TrelloSyncService } from './sync/trello-sync.service';

type RawBodyRequest = Request & { rawBody?: Buffer };

/** The action of a Trello delivery (one per delivery). */
export interface TrelloWebhookAction {
	type?: string;
	data?: { card?: { id?: string } | null; board?: { id?: string } | null; list?: { id?: string } | null } | null;
}

/** Actions after which the card is read again; a deleted card has nothing to read. */
const CARD_ACTIONS = new Set([
	'createCard',
	'updateCard',
	'copyCard',
	'moveCardToBoard',
	'convertToCardFromCheckItem',
	'addMemberToCard',
	'removeMemberFromCard',
	'addLabelToCard',
	'removeLabelFromCard',
	'updateCheckItemStateOnCard',
	'addAttachmentToCard',
	'deleteAttachmentFromCard',
	'commentCard',
	'updateComment',
	'deleteComment'
]);

/**
 * Whether the delivery is what Trello signed: `x-trello-webhook` is the base64 HMAC-SHA1, with the application's
 * secret, of the raw body followed by the callback URL as it was registered.
 */
export function isTrelloSignatureValid(secret: string, rawBody: Buffer, callbackUrl: string, signature: string | undefined): boolean {
	if (!signature || !/^[A-Za-z0-9+/]+=*$/.test(signature)) return false;
	const expected = createHmac('sha1', secret).update(Buffer.concat([rawBody, Buffer.from(callbackUrl, 'utf8')])).digest();
	let given: Buffer;
	try {
		given = Buffer.from(signature, 'base64');
	} catch {
		return false;
	}
	return given.length === expected.length && timingSafeEqual(given, expected);
}

/** The id of the card a delivery's action concerns, when it is one to read again. */
export function cardIdOf(action: TrelloWebhookAction | undefined): string | null {
	if (!action || !action.type || !CARD_ACTIONS.has(action.type)) return null;
	const id = action.data?.card?.id;
	return typeof id === 'string' && /^[a-f0-9]{24}$/i.test(id) ? id : null;
}

/**
 * `/integration/trello/webhook/:mappingId`: Trello's deliveries for one mapping's board. Public, so everything
 * rests on the mapping named in the path and on Trello's scheme: when a webhook is registered Trello sends a
 * HEAD request, answered 200; every delivery is a POST signed with the application's secret over the raw body
 * and the callback URL (`x-trello-webhook`). A delivery is acknowledged as soon as the signature checks, then the
 * card its action names is read again from Trello and applied behind the response. Nothing in the payload picks
 * the tenant: the mapping does.
 */
@ApiExcludeController()
@Public()
@Controller(`${TRELLO_ROUTE_PREFIX}/webhook`)
export class TrelloWebhookController {
	private readonly logger = new Logger(TrelloWebhookController.name);

	constructor(
		@Inject(TRELLO_CONFIG) private readonly config: TrelloConfig,
		private readonly mappings: TrelloMappingService,
		private readonly tenants: TrelloTenantService,
		private readonly sync: TrelloSyncService
	) {}

	/** Trello checks the callback with a HEAD request when the webhook is registered. */
	@Head('/:mappingId')
	@HttpCode(HttpStatus.OK)
	@Header('Cache-Control', 'no-store')
	async check(@Param('mappingId') mappingId: string): Promise<void> {
		if (!isUUID(mappingId) || !(await this.mappings.findAnyById(mappingId as ID))) throw new NotFoundException();
	}

	@Post('/:mappingId')
	@HttpCode(HttpStatus.OK)
	@Header('Cache-Control', 'no-store')
	async receive(
		@Param('mappingId') mappingId: string,
		@Req() request: RawBodyRequest,
		@Headers('x-trello-webhook') signature?: string
	): Promise<{ accepted: boolean; queued: number }> {
		if (!isUUID(mappingId)) throw new NotFoundException();
		const mapping = await this.mappings.findAnyById(mappingId as ID);
		if (!mapping) throw new NotFoundException();
		const callbackUrl = trelloWebhookTargetOf(this.config, mapping.id as string);
		if (!callbackUrl || !this.config.apiSecret) throw new UnauthorizedException('Webhooks are not configured on this server.');

		const raw = request.rawBody;
		if (!Buffer.isBuffer(raw) || raw.length === 0) throw new BadRequestException('The raw request body is required.');
		if (raw.length > TRELLO_WEBHOOK_MAX_BYTES) throw new BadRequestException('The webhook body is too large.');
		if (!isTrelloSignatureValid(this.config.apiSecret, raw, callbackUrl, signature)) {
			throw new UnauthorizedException('Invalid or missing Trello webhook signature.');
		}
		let payload: { action?: TrelloWebhookAction };
		try {
			payload = JSON.parse(raw.toString('utf8'));
		} catch {
			throw new BadRequestException('The webhook body is not JSON.');
		}
		const cardId = cardIdOf(payload.action);
		if (!cardId) return { accepted: true, queued: 0 };

		const tenant = await this.tenants.findAnyById(mapping.integrationId);
		if (!tenant) return { accepted: true, queued: 0 };
		// Answered now; applied behind the response.
		setImmediate(() => {
			this.sync.applyCardsFromWebhook(tenant, mapping, [cardId]).catch((error: unknown) => {
				this.logger.warn(`Webhook card of mapping ${mapping.id} could not be applied: ${error instanceof Error ? error.message : String(error)}`);
			});
		});
		return { accepted: true, queued: 1 };
	}
}
