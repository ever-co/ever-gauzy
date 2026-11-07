import { Body, Controller, Delete, Get, Header, HttpCode, HttpStatus, Param, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ID, IInboxPushPublicKey, IInboxPushSubscription, PermissionsEnum } from '@gauzy/contracts';
import { PermissionGuard, Permissions, TenantPermissionGuard, UseValidationPipe, UUIDValidationPipe } from '@gauzy/core';
import { INBOX_ROUTE_PREFIX } from '../../inbox.constants';
import { InboxWebPushEnabledGuard } from './inbox-push-enabled.guard';
import { InboxPushSubscribeDTO } from './inbox-push.dto';
import { InboxPushSubscriptionService } from './inbox-push-subscription.service';

/**
 * `/api/inbox/push-subscriptions*` (the Inbox spec FR-13): the caller's own devices. Every route needs a signed-in
 * user of the tenant with `INBOX_VIEW`; the routes answer 404 where web push is off or the keys are not set.
 */
@ApiTags('Inbox')
@ApiBearerAuth()
@UseGuards(TenantPermissionGuard, PermissionGuard, InboxWebPushEnabledGuard)
@Permissions(PermissionsEnum.INBOX_VIEW)
@Controller(`${INBOX_ROUTE_PREFIX}/push-subscriptions`)
export class InboxPushController {
	constructor(private readonly subscriptions: InboxPushSubscriptionService) {}

	@Get('/public-key')
	@Header('Cache-Control', 'no-store')
	@ApiOperation({ summary: 'The VAPID public key a browser subscribes with.' })
	publicKey(): IInboxPushPublicKey {
		return { publicKey: this.subscriptions.publicKey() as string };
	}

	@Get()
	@Header('Cache-Control', 'no-store')
	@ApiOperation({ summary: 'My subscribed devices.' })
	list(): Promise<IInboxPushSubscription[]> {
		return this.subscriptions.listMine();
	}

	@Post()
	@HttpCode(HttpStatus.CREATED)
	@UseValidationPipe({ transform: true, whitelist: true })
	@Header('Cache-Control', 'no-store')
	@ApiOperation({ summary: 'Register this browser (or refresh its subscription).' })
	register(@Body() body: InboxPushSubscribeDTO): Promise<IInboxPushSubscription> {
		return this.subscriptions.register(body);
	}

	@Delete('/:id')
	@HttpCode(HttpStatus.NO_CONTENT)
	@ApiOperation({ summary: 'Remove one of my devices.' })
	async remove(@Param('id', UUIDValidationPipe) id: ID): Promise<void> {
		await this.subscriptions.remove(id);
	}
}
