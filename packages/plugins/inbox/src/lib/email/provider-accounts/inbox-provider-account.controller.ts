import {
	Body,
	Controller,
	Delete,
	Get,
	Header,
	HttpCode,
	HttpStatus,
	Param,
	Patch,
	Post,
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
import {
	CreateInboxProviderAccountDTO,
	InboxOrganizationQueryDTO,
	UpdateInboxProviderAccountDTO
} from './inbox-provider-account.dto';
import { InboxProviderAccountService } from './inbox-provider-account.service';

/**
 * `/api/inbox/providers` and `/api/inbox/provider-accounts*` (plan 04 §3): the registered email provider plugins,
 * and the organization's and tenant's accounts with them. `INBOX_MAILBOX_MANAGE` and a membership of the
 * organization; secrets are write-only and never answered, and every answer is `Cache-Control: no-store`.
 */
@ApiTags('Inbox')
@ApiBearerAuth()
@UseGuards(TenantPermissionGuard, PermissionGuard)
@Permissions(PermissionsEnum.INBOX_MAILBOX_MANAGE)
@Controller(INBOX_ROUTE_PREFIX)
export class InboxProviderAccountController {
	constructor(private readonly accounts: InboxProviderAccountService) {}

	@Get('/providers')
	@Header('Cache-Control', 'no-store')
	@ApiOperation({ summary: 'The email provider plugins of this server, with their capabilities and forms.' })
	providers() {
		return this.accounts.providers();
	}

	@Get('/provider-accounts')
	@UseValidationPipe({ transform: true, whitelist: true })
	@Header('Cache-Control', 'no-store')
	@ApiOperation({ summary: "The organization's and the tenant's email provider accounts (no secrets)." })
	list(@Query() query: InboxOrganizationQueryDTO) {
		return this.accounts.list(query?.organizationId);
	}

	@Post('/provider-accounts')
	@UseValidationPipe({ transform: true, whitelist: true })
	@Header('Cache-Control', 'no-store')
	@ApiOperation({
		summary: 'Add an email provider account; secrets the server generates are answered this once only.'
	})
	create(@Body() body: CreateInboxProviderAccountDTO) {
		return this.accounts.create(body);
	}

	@Get('/provider-accounts/:id')
	@UseValidationPipe({ transform: true, whitelist: true })
	@Header('Cache-Control', 'no-store')
	@ApiOperation({ summary: 'One email provider account (no secrets).' })
	get(@Param('id', UUIDValidationPipe) id: ID, @Query() query: InboxOrganizationQueryDTO) {
		return this.accounts.get(id, query?.organizationId);
	}

	@Patch('/provider-accounts/:id')
	@UseValidationPipe({ transform: true, whitelist: true })
	@Header('Cache-Control', 'no-store')
	@ApiOperation({ summary: 'Rename, reconfigure, disable or make an account the outbound default.' })
	update(
		@Param('id', UUIDValidationPipe) id: ID,
		@Body() body: UpdateInboxProviderAccountDTO,
		@Query() query: InboxOrganizationQueryDTO
	) {
		return this.accounts.update(id, body, query?.organizationId);
	}

	@Delete('/provider-accounts/:id')
	@HttpCode(HttpStatus.OK)
	@UseValidationPipe({ transform: true, whitelist: true })
	@Header('Cache-Control', 'no-store')
	@ApiOperation({
		summary: 'Remove an account (kept as deleted and disabled); refused while a mailbox receives through it.'
	})
	remove(@Param('id', UUIDValidationPipe) id: ID, @Query() query: InboxOrganizationQueryDTO) {
		return this.accounts.remove(id, query?.organizationId);
	}

	@Post('/provider-accounts/:id/verify')
	@HttpCode(HttpStatus.OK)
	@UseValidationPipe({ transform: true, whitelist: true })
	@Header('Cache-Control', 'no-store')
	@ApiOperation({ summary: 'Test connection: the provider checks the account’s credentials.' })
	verify(@Param('id', UUIDValidationPipe) id: ID, @Query() query: InboxOrganizationQueryDTO) {
		return this.accounts.verify(id, query?.organizationId);
	}
}
