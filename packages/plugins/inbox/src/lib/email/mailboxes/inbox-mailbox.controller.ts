import {
	Body,
	Controller,
	Get,
	Header,
	HttpCode,
	HttpStatus,
	Param,
	Patch,
	Post,
	Put,
	Query,
	UseGuards
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ID, PermissionsEnum } from '@gauzy/contracts';
import {
	PermissionGuard,
	Permissions,
	TenantPermissionGuard,
	UseValidationPipe,
	UUIDValidationPipe
} from '@gauzy/core';
import { INBOX_ROUTE_PREFIX } from '../../inbox.constants';
import { InboxOrganizationQueryDTO } from '../provider-accounts/inbox-provider-account.dto';
import {
	CreateInboxMailboxDTO,
	InboxEmailSettingsDTO,
	ProvisionInboxMailboxesDTO,
	SetInboxMailboxMembersDTO,
	UpdateInboxMailboxDTO
} from './inbox-mailbox.dto';
import { InboxMailboxService } from './inbox-mailbox.service';

/**
 * `/api/inbox/mailboxes*` (plan 04 §3, G-P4-1). Management needs `INBOX_MAILBOX_MANAGE` and a membership of the
 * organization; `GET /mailboxes/mine` (the caller's own mailboxes and forwarding instructions) needs `INBOX_VIEW`.
 * A rotated secret is answered once; every answer is `Cache-Control: no-store`.
 */
@ApiTags('Inbox')
@ApiBearerAuth()
@UseGuards(TenantPermissionGuard, PermissionGuard)
@Controller(`${INBOX_ROUTE_PREFIX}/mailboxes`)
export class InboxMailboxController {
	constructor(private readonly mailboxes: InboxMailboxService) {}

	@Get('/mine')
	@Permissions(PermissionsEnum.INBOX_VIEW)
	@Header('Cache-Control', 'no-store')
	@ApiOperation({ summary: 'My mailboxes (my employee mailbox and the shared ones I am a member of).' })
	mine() {
		return this.mailboxes.mine();
	}

	@Get('/settings')
	@Permissions(PermissionsEnum.INBOX_MAILBOX_MANAGE)
	@UseValidationPipe({ transform: true, whitelist: true })
	@Header('Cache-Control', 'no-store')
	@ApiOperation({ summary: "The organization's Inbox email settings (auto-provisioning)." })
	settings(@Query() query: InboxOrganizationQueryDTO) {
		return this.mailboxes.settings(query?.organizationId);
	}

	@Put('/settings')
	@Permissions(PermissionsEnum.INBOX_MAILBOX_MANAGE)
	@UseValidationPipe({ transform: true, whitelist: true })
	@Header('Cache-Control', 'no-store')
	@ApiOperation({ summary: 'Create a mailbox for every new employee (or stop doing so).' })
	updateSettings(@Body() body: InboxEmailSettingsDTO, @Query() query: InboxOrganizationQueryDTO) {
		return this.mailboxes.updateSettings(body, query?.organizationId);
	}

	@Post('/provision')
	@Permissions(PermissionsEnum.INBOX_MAILBOX_MANAGE)
	@HttpCode(HttpStatus.OK)
	@UseValidationPipe({ transform: true, whitelist: true })
	@Header('Cache-Control', 'no-store')
	@ApiOperation({ summary: 'Create the missing employee mailboxes and the default organization mailbox now.' })
	provision(@Body() body: ProvisionInboxMailboxesDTO) {
		return this.mailboxes.provision(body);
	}

	@Get()
	@Permissions(PermissionsEnum.INBOX_MAILBOX_MANAGE)
	@UseValidationPipe({ transform: true, whitelist: true })
	@Header('Cache-Control', 'no-store')
	@ApiOperation({ summary: "The organization's mailboxes." })
	list(@Query() query: InboxOrganizationQueryDTO) {
		return this.mailboxes.list(query?.organizationId);
	}

	@Post()
	@Permissions(PermissionsEnum.INBOX_MAILBOX_MANAGE)
	@UseValidationPipe({ transform: true, whitelist: true })
	@Header('Cache-Control', 'no-store')
	@ApiOperation({ summary: 'Create a mailbox (platform address, custom domain or forwarding).' })
	create(@Body() body: CreateInboxMailboxDTO) {
		return this.mailboxes.create(body);
	}

	@Get('/:id')
	@Permissions(PermissionsEnum.INBOX_MAILBOX_MANAGE)
	@UseValidationPipe({ transform: true, whitelist: true })
	@Header('Cache-Control', 'no-store')
	@ApiOperation({ summary: 'One mailbox.' })
	get(@Param('id', UUIDValidationPipe) id: ID, @Query() query: InboxOrganizationQueryDTO) {
		return this.mailboxes.get(id, query?.organizationId);
	}

	@Patch('/:id')
	@Permissions(PermissionsEnum.INBOX_MAILBOX_MANAGE)
	@UseValidationPipe({ transform: true, whitelist: true })
	@Header('Cache-Control', 'no-store')
	@ApiOperation({ summary: 'Rename, (de)activate, change the allowlist, the account or the settings.' })
	update(
		@Param('id', UUIDValidationPipe) id: ID,
		@Body() body: UpdateInboxMailboxDTO,
		@Query() query: InboxOrganizationQueryDTO
	) {
		return this.mailboxes.update(id, body, query?.organizationId);
	}

	@Post('/:id/verify')
	@Permissions(PermissionsEnum.INBOX_MAILBOX_MANAGE)
	@HttpCode(HttpStatus.OK)
	@UseValidationPipe({ transform: true, whitelist: true })
	@Header('Cache-Control', 'no-store')
	@ApiOperation({ summary: 'Check the DNS TXT record of a custom domain (_gauzy-inbox.<domain>).' })
	verify(@Param('id', UUIDValidationPipe) id: ID, @Query() query: InboxOrganizationQueryDTO) {
		return this.mailboxes.verify(id, query?.organizationId);
	}

	@Get('/:id/verification')
	@Permissions(PermissionsEnum.INBOX_MAILBOX_MANAGE)
	@UseValidationPipe({ transform: true, whitelist: true })
	@Header('Cache-Control', 'no-store')
	@ApiOperation({ summary: 'The DNS TXT record a custom domain is proven with, and its last status (no lookup).' })
	verification(@Param('id', UUIDValidationPipe) id: ID, @Query() query: InboxOrganizationQueryDTO) {
		return this.mailboxes.verification(id, query?.organizationId);
	}

	@Post('/:id/rotate-secret')
	@Permissions(PermissionsEnum.INBOX_MAILBOX_MANAGE)
	@HttpCode(HttpStatus.OK)
	@UseValidationPipe({ transform: true, whitelist: true })
	@Header('Cache-Control', 'no-store')
	@ApiOperation({ summary: 'A new relay secret for the mailbox, answered this once.' })
	rotateSecret(@Param('id', UUIDValidationPipe) id: ID, @Query() query: InboxOrganizationQueryDTO) {
		return this.mailboxes.rotateSecret(id, query?.organizationId);
	}

	@Get('/:id/members')
	@Permissions(PermissionsEnum.INBOX_MAILBOX_MANAGE)
	@UseValidationPipe({ transform: true, whitelist: true })
	@Header('Cache-Control', 'no-store')
	@ApiOperation({ summary: 'The members of a shared mailbox.' })
	members(@Param('id', UUIDValidationPipe) id: ID, @Query() query: InboxOrganizationQueryDTO) {
		return this.mailboxes.members(id, query?.organizationId);
	}

	@Put('/:id/members')
	@Permissions(PermissionsEnum.INBOX_MAILBOX_MANAGE)
	@UseValidationPipe({ transform: true, whitelist: true })
	@Header('Cache-Control', 'no-store')
	@ApiOperation({ summary: 'Replace the members of a shared mailbox.' })
	setMembers(
		@Param('id', UUIDValidationPipe) id: ID,
		@Body() body: SetInboxMailboxMembersDTO,
		@Query() query: InboxOrganizationQueryDTO
	) {
		return this.mailboxes.setMembers(id, body.members, query?.organizationId);
	}
}
