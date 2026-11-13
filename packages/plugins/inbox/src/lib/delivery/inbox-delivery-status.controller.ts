import { Controller, Get, Header, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { IInboxDeliveryStatus, PermissionsEnum } from '@gauzy/contracts';
import { PermissionGuard, Permissions, TenantPermissionGuard } from '@gauzy/core';
import { INBOX_ROUTE_PREFIX } from '../inbox.constants';
import { InboxDeliveryStatusService } from './inbox-delivery-status.service';

/**
 * Which delivery channels the Inbox can use for the caller's organization. The route exists where the delivery plugin
 * is loaded (`GAUZY_INBOX_NOTIFICATION_EMAIL_ENABLED` or `GAUZY_INBOX_WEB_PUSH_ENABLED`); elsewhere it answers 404.
 */
@ApiTags('Inbox')
@ApiBearerAuth()
@UseGuards(TenantPermissionGuard, PermissionGuard)
@Permissions(PermissionsEnum.INBOX_VIEW)
@Controller(`${INBOX_ROUTE_PREFIX}/delivery`)
export class InboxDeliveryStatusController {
	constructor(private readonly statusService: InboxDeliveryStatusService) {}

	@Get('/status')
	@Header('Cache-Control', 'no-store')
	@ApiOperation({ summary: 'Whether notification emails and web push can be delivered for my organization.' })
	status(): Promise<IInboxDeliveryStatus> {
		return this.statusService.status();
	}
}
