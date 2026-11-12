import { Body, Controller, Delete, Get, Header, Headers, HttpCode, HttpStatus, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiHeader, ApiOperation, ApiTags } from '@nestjs/swagger';
import { FeatureFlag } from '@gauzy/common';
import { FeatureEnum, ID, PermissionsEnum } from '@gauzy/contracts';
import { FeatureFlagGuard, PermissionGuard, Permissions, TenantPermissionGuard, UseValidationPipe, UUIDValidationPipe } from '@gauzy/core';
import { CHAT_ROUTE_PREFIX } from '../chat.constants';
import { ChatInteractionDTO, ChatWebhookCreateDTO, ChatWebhookUpdateDTO } from '../dto/chat-webhook.dto';
import { ChatAccessService } from '../services/chat-access.service';
import { CHAT_INTERACTION_KEY_HEADER, ChatInteractionService } from '../webhooks/chat-interaction.service';
import { ChatWebhooksEnabledGuard } from '../webhooks/chat-webhooks-enabled.guard';
import { ChatWebhookService } from '../webhooks/chat-webhook.service';

/**
 * `/api/chat/conversations/:id/webhooks`, `/api/chat/webhooks/:id*`, `/api/chat/messages/:id/interactions`,
 * `/api/chat/interactions/:id`: a channel's incoming webhooks and the clicks on their buttons. Same guards as every
 * chat route (`CHAT_VIEW`, checked again by `ChatAccessService.caller()`, and the tenant's `FEATURE_CHAT`); the writes
 * need `CHAT_SEND`, a webhook write also a manager of the channel (its managers, its creator, `CHAT_MANAGE`). Every
 * route answers 404 unless `GAUZY_CHAT_WEBHOOKS_ENABLED=true`, and for a conversation the caller is not in. The URL
 * and the signing secret are in the answer of the write that made them, and never again. `Cache-Control: no-store`.
 */
@ApiTags('Chat')
@ApiBearerAuth()
@UseGuards(ChatWebhooksEnabledGuard, TenantPermissionGuard, PermissionGuard, FeatureFlagGuard)
@FeatureFlag(FeatureEnum.FEATURE_CHAT)
@Permissions(PermissionsEnum.CHAT_VIEW)
@Controller(CHAT_ROUTE_PREFIX)
export class ChatWebhookController {
	constructor(
		private readonly access: ChatAccessService,
		private readonly webhooks: ChatWebhookService,
		private readonly interactions: ChatInteractionService
	) {}

	@Get('/conversations/:id/webhooks')
	@Header('Cache-Control', 'no-store')
	@ApiOperation({ summary: 'The incoming webhooks of a channel I manage, newest first (revoked ones included).' })
	list(@Param('id', UUIDValidationPipe) id: ID) {
		return this.webhooks.list(this.access.caller(), id);
	}

	@Post('/conversations/:id/webhooks')
	@Permissions(PermissionsEnum.CHAT_SEND)
	@HttpCode(HttpStatus.CREATED)
	@Header('Cache-Control', 'no-store')
	@UseValidationPipe({ whitelist: true })
	@ApiOperation({ summary: 'Create an incoming webhook for a channel I manage; the answer holds its URL and signing secret, shown this once.' })
	create(@Param('id', UUIDValidationPipe) id: ID, @Body() body: ChatWebhookCreateDTO) {
		return this.webhooks.create(this.access.caller(), id, body);
	}

	@Patch('/webhooks/:id')
	@Permissions(PermissionsEnum.CHAT_SEND)
	@Header('Cache-Control', 'no-store')
	@UseValidationPipe({ whitelist: true })
	@ApiOperation({ summary: 'Rename a webhook, or change its icon, interaction URL or broadcast right.' })
	update(@Param('id', UUIDValidationPipe) id: ID, @Body() body: ChatWebhookUpdateDTO) {
		return this.webhooks.update(this.access.caller(), id, body);
	}

	@Post('/webhooks/:id/secret')
	@Permissions(PermissionsEnum.CHAT_SEND)
	@HttpCode(HttpStatus.OK)
	@Header('Cache-Control', 'no-store')
	@ApiOperation({ summary: 'A new signing secret for the interaction callbacks, shown this once.' })
	rotateSecret(@Param('id', UUIDValidationPipe) id: ID) {
		return this.webhooks.rotateSecret(this.access.caller(), id);
	}

	@Delete('/webhooks/:id')
	@Permissions(PermissionsEnum.CHAT_SEND)
	@HttpCode(HttpStatus.OK)
	@Header('Cache-Control', 'no-store')
	@ApiOperation({ summary: 'Revoke a webhook: its URL answers 404 from now on (the row stays for the history).' })
	revoke(@Param('id', UUIDValidationPipe) id: ID) {
		return this.webhooks.revoke(this.access.caller(), id);
	}

	/**
	 * The click's idempotency key comes in the `Idempotency-Key` header, as on the receive route (`POST /hooks/:token`)
	 * and on the platform's other retry-safe writes (it is in the API's CORS `allowedHeaders`): it qualifies the
	 * request, not the button, so the body stays the click, a client's HTTP layer can set it on a retry without
	 * rebuilding the body, and a proxy that forwards the request forwards it verbatim. It is stored on the
	 * interaction row (not through the platform's `@Idempotent()` replay store): a repeat answers the click as it is
	 * now — delivered, retrying, failed — not the first answer as it was.
	 */
	@Post('/messages/:id/interactions')
	@Permissions(PermissionsEnum.CHAT_SEND)
	@HttpCode(HttpStatus.OK)
	@Header('Cache-Control', 'no-store')
	@UseValidationPipe({ whitelist: true })
	@ApiOperation({ summary: 'Click a button of an app message: a signed callback to the app, whose reply may replace the message.' })
	@ApiHeader({
		name: CHAT_INTERACTION_KEY_HEADER,
		required: false,
		description: 'A key per click (a UUID; at most 64 printable characters), the same on each retry of that click: a repeat answers the first click as it is now and calls the app no second time; the same key for another button is refused (409).'
	})
	interact(@Param('id', UUIDValidationPipe) id: ID, @Body() body: ChatInteractionDTO, @Headers('idempotency-key') idempotencyKey?: string) {
		return this.interactions.interact(this.access.employeeCaller(), id, body, idempotencyKey);
	}

	@Get('/interactions/:id')
	@Header('Cache-Control', 'no-store')
	@ApiOperation({ summary: 'The state of one of my clicks (delivered, retrying, failed).' })
	interaction(@Param('id', UUIDValidationPipe) id: ID) {
		return this.interactions.state(this.access.caller(), id);
	}
}
