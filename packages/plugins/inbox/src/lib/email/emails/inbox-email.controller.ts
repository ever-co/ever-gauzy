import {
	Body,
	Controller,
	Get,
	Header,
	HttpCode,
	HttpStatus,
	Param,
	Post,
	Query,
	Res,
	StreamableFile,
	UseGuards
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ArrayMaxSize, IsArray, IsBoolean, IsEmail, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';
import { ID, IInboxEmailForwardInput, IInboxEmailReplyInput, PermissionsEnum } from '@gauzy/contracts';
import { PermissionGuard, Permissions, TenantPermissionGuard, UseValidationPipe, UUIDValidationPipe } from '@gauzy/core';
import { INBOX_ROUTE_PREFIX } from '../../inbox.constants';
import { InboxEmailDownload, InboxEmailService, MAX_OUTBOUND_RECIPIENTS, MAX_OUTBOUND_TEXT } from './inbox-email.service';

export class InboxEmailReplyDTO implements IInboxEmailReplyInput {
	@IsString()
	@MaxLength(MAX_OUTBOUND_TEXT)
	text!: string;

	@IsOptional()
	@IsBoolean()
	replyAll?: boolean;

	@IsOptional()
	@IsArray()
	@ArrayMaxSize(MAX_OUTBOUND_RECIPIENTS)
	@IsEmail({}, { each: true })
	cc?: string[];
}

export class InboxEmailForwardDTO implements IInboxEmailForwardInput {
	@IsArray()
	@ArrayMaxSize(MAX_OUTBOUND_RECIPIENTS)
	@IsEmail({}, { each: true })
	to!: string[];

	@IsOptional()
	@IsString()
	@MaxLength(MAX_OUTBOUND_TEXT)
	text?: string;

	@IsOptional()
	@IsBoolean()
	includeAttachments?: boolean;
}

export class InboxQuarantineQueryDTO {
	@IsUUID()
	mailboxId!: ID;
}

/** The response fields a download sets (Express's response, without depending on its types). */
interface DownloadResponse {
	setHeader(name: string, value: string): void;
}

/** RFC 6266 `attachment` with an ASCII fallback and the UTF-8 name. */
function contentDisposition(filename: string): string {
	const ascii = filename.replace(/[^\x20-\x7e]/g, '_').replace(/["\\]/g, '_');
	return `attachment; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(filename)}`;
}

/**
 * `/api/inbox/emails*` (plan 04 §3): the stored messages of the caller's mailboxes. `INBOX_VIEW`; each route also
 * checks the caller's access to the message's mailbox (see `InboxEmailService`). Downloads are always attachments with
 * `nosniff`, never rendered inline; answers are `Cache-Control: no-store`.
 */
@ApiTags('Inbox')
@ApiBearerAuth()
@UseGuards(TenantPermissionGuard, PermissionGuard)
@Permissions(PermissionsEnum.INBOX_VIEW)
@Controller(`${INBOX_ROUTE_PREFIX}/emails`)
export class InboxEmailController {
	constructor(private readonly emails: InboxEmailService) {}

	@Get('/quarantine')
	@UseValidationPipe({ transform: true, whitelist: true })
	@Header('Cache-Control', 'no-store')
	@ApiOperation({ summary: 'The quarantined messages of a mailbox (its managers).' })
	quarantine(@Query() query: InboxQuarantineQueryDTO) {
		return this.emails.quarantine(query.mailboxId);
	}

	@Get('/:id')
	@Header('Cache-Control', 'no-store')
	@ApiOperation({ summary: 'One message: sanitized HTML, text, addresses, attachment metadata.' })
	get(@Param('id', UUIDValidationPipe) id: ID) {
		return this.emails.get(id);
	}

	@Get('/:id/thread')
	@Header('Cache-Control', 'no-store')
	@ApiOperation({ summary: 'The messages of the message’s thread, oldest first.' })
	thread(@Param('id', UUIDValidationPipe) id: ID) {
		return this.emails.thread(id);
	}

	@Get('/:id/raw')
	@Header('Cache-Control', 'no-store')
	@ApiOperation({ summary: 'The raw message (.eml), for the mailbox’s managers.' })
	async raw(@Param('id', UUIDValidationPipe) id: ID, @Res({ passthrough: true }) response: DownloadResponse) {
		return this.download(await this.emails.raw(id), response);
	}

	@Get('/:id/attachments/:attachmentId')
	@Header('Cache-Control', 'no-store')
	@ApiOperation({ summary: 'Download an attachment.' })
	async attachment(
		@Param('id', UUIDValidationPipe) id: ID,
		@Param('attachmentId', UUIDValidationPipe) attachmentId: ID,
		@Res({ passthrough: true }) response: DownloadResponse
	) {
		return this.download(await this.emails.attachment(id, attachmentId), response);
	}

	@Post('/:id/reply')
	@HttpCode(HttpStatus.OK)
	@UseValidationPipe({ transform: true, whitelist: true })
	@Header('Cache-Control', 'no-store')
	@ApiOperation({ summary: 'Reply from the mailbox’s address, in the thread.' })
	reply(@Param('id', UUIDValidationPipe) id: ID, @Body() body: InboxEmailReplyDTO) {
		return this.emails.reply(id, body);
	}

	@Post('/:id/forward')
	@HttpCode(HttpStatus.OK)
	@UseValidationPipe({ transform: true, whitelist: true })
	@Header('Cache-Control', 'no-store')
	@ApiOperation({ summary: 'Forward the message (with its attachments) from the mailbox’s address.' })
	forward(@Param('id', UUIDValidationPipe) id: ID, @Body() body: InboxEmailForwardDTO) {
		return this.emails.forward(id, body);
	}

	@Post('/:id/release')
	@HttpCode(HttpStatus.OK)
	@Header('Cache-Control', 'no-store')
	@ApiOperation({ summary: 'Release a quarantined message into the mailbox recipients’ inboxes (its managers).' })
	release(@Param('id', UUIDValidationPipe) id: ID) {
		return this.emails.release(id);
	}

	private download(file: InboxEmailDownload, response: DownloadResponse): StreamableFile {
		response.setHeader('Content-Type', file.contentType);
		response.setHeader('Content-Disposition', contentDisposition(file.filename));
		response.setHeader('X-Content-Type-Options', 'nosniff');
		response.setHeader('Content-Security-Policy', "default-src 'none'; sandbox");
		return new StreamableFile(file.content);
	}
}
