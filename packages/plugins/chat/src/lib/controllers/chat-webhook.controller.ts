import { Body, Controller, Delete, Get, Header, HttpCode, HttpStatus, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { FeatureFlag } from '@gauzy/common';
import { FeatureEnum, ID, PermissionsEnum } from '@gauzy/contracts';
import { FeatureFlagGuard, PermissionGuard, Permissions, TenantPermissionGuard, UseValidationPipe, UUIDValidationPipe } from '@gauzy/core';
import { CHAT_ROUTE_PREFIX } from '../chat.constants';
import { ChatInteractionDTO, ChatWebhookCreateDTO, ChatWebhookUpdateDTO } from '../dto/chat-webhook.dto';
import { ChatAccessService } from '../services/chat-access.service';
import { ChatInteractionService } from '../webhooks/chat-interaction.service';
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
@UseGuards(TenantPermissionGuard, PermissionGuard, FeatureFlagGuard)
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

	@Post('/messages/:id/interactions')
	@Permissions(PermissionsEnum.CHAT_SEND)
	@HttpCode(HttpStatus.OK)
	@Header('Cache-Control', 'no-store')
	@UseValidationPipe({ whitelist: true })
	@ApiOperation({ summary: 'Click a button of an app message: a signed callback to the app, whose reply may replace the message.' })
	interact(@Param('id', UUIDValidationPipe) id: ID, @Body() body: ChatInteractionDTO) {
		return this.interactions.interact(this.access.employeeCaller(), id, body);
	}

	@Get('/interactions/:id')
	@Header('Cache-Control', 'no-store')
	@ApiOperation({ summary: 'The state of one of my clicks (delivered, retrying, failed).' })
	interaction(@Param('id', UUIDValidationPipe) id: ID) {
		return this.interactions.state(this.access.caller(), id);
	}
}
