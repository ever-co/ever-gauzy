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
import { InboxItemQueryDTO, InboxMarkAllReadDTO, InboxReplyDTO, InboxStateDTO, InboxTabDTO } from './dto/inbox.dto';
import { INBOX_ROUTE_PREFIX } from './inbox.constants';
import { InboxService } from './inbox.service';

/**
 * `/api/inbox/items*` (plan 04 §3): the caller's inbox. Every route needs a signed-in user of the tenant with
 * `INBOX_VIEW`; the recipient is always the caller, never a parameter. Answers are `Cache-Control: no-store`
 * (they are one user's own items).
 */
@ApiTags('Inbox')
@ApiBearerAuth()
@UseGuards(TenantPermissionGuard, PermissionGuard)
@Permissions(PermissionsEnum.INBOX_VIEW)
@Controller(`${INBOX_ROUTE_PREFIX}/items`)
export class InboxController {
	constructor(private readonly inbox: InboxService) {}

	@Get()
	@UseValidationPipe({ transform: true, whitelist: true })
	@Header('Cache-Control', 'no-store')
	@ApiOperation({ summary: 'A page of my inbox items, newest first (tab, filters, cursor).' })
	list(@Query() query: InboxItemQueryDTO) {
		return this.inbox.list(query);
	}

	@Get('/counts')
	@Header('Cache-Control', 'no-store')
	@ApiOperation({ summary: 'My unread and open-decision counts (the header badge).' })
	counts() {
		return this.inbox.counts();
	}

	@Post('/mark-all-read')
	@HttpCode(HttpStatus.OK)
	@UseValidationPipe({ transform: true, whitelist: true })
	@Header('Cache-Control', 'no-store')
	@ApiOperation({ summary: 'Mark every unread item of mine (of a tab, and of the filters stated) read.' })
	markAllRead(@Body() body: InboxMarkAllReadDTO) {
		return this.inbox.markAllRead(body?.tab, { kind: body?.kind, source: body?.source, q: body?.q });
	}

	@Get('/:id')
	@Header('Cache-Control', 'no-store')
	@ApiOperation({ summary: 'One of my inbox items, with my state.' })
	get(@Param('id', UUIDValidationPipe) id: ID) {
		return this.inbox.get(id);
	}

	@Post('/:id/reply')
	@HttpCode(HttpStatus.OK)
	@UseValidationPipe({ transform: true, whitelist: true })
	@Header('Cache-Control', 'no-store')
	@ApiOperation({
		summary: 'Answer a question, an approval or an escalation (delivered to its source synchronously).'
	})
	reply(@Param('id', UUIDValidationPipe) id: ID, @Body() body: InboxReplyDTO) {
		return this.inbox.reply(id, body);
	}

	@Patch('/:id/state')
	@UseValidationPipe({ transform: true, whitelist: true })
	@Header('Cache-Control', 'no-store')
	@ApiOperation({ summary: 'Mark read / unread, archive / unarchive or snooze one of my items.' })
	setState(@Param('id', UUIDValidationPipe) id: ID, @Body() body: InboxStateDTO) {
		return this.inbox.setState(id, body);
	}
}
