import { Body, Controller, Get, HttpCode, HttpStatus, Param, Post, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { FeatureFlag } from '@gauzy/common';
import { FeatureEnum, ID, PermissionsEnum } from '@gauzy/contracts';
import {
	FeatureFlagGuard,
	PermissionGuard,
	Permissions,
	TenantPermissionGuard,
	UseValidationPipe,
	UUIDValidationPipe
} from '@gauzy/core';
import { DocumentLiveAwarenessDTO, DocumentLiveUpdateDTO } from './document-live.dto';
import { DocumentLiveService } from './document-live.service';
import { IDocumentLiveAck, IDocumentLiveStatus } from './document-live.types';

/**
 * The client's half of a live editing session: its edits (Yjs updates) and its cursor and presence (awareness
 * updates). The server's half is `Subscription.documentLive`, which also says when the session is read-only.
 *
 * Both routes answer for a session the caller opened: 404 `DOCS_LIVE_SESSION_NOT_FOUND` otherwise (the client opens
 * the session again), 403 `DOCS_LIVE_READ_ONLY` for an edit of a read-only session, 413 `DOCS_LIVE_TOO_LARGE` past
 * the size limits.
 */
@ApiTags('Documents Plugin')
@UseGuards(TenantPermissionGuard, PermissionGuard, FeatureFlagGuard)
@FeatureFlag(FeatureEnum.FEATURE_DOCUMENTS)
@Controller('/plugins/docs')
export class DocumentLiveController {
	constructor(private readonly live: DocumentLiveService) {}

	@ApiOperation({ summary: 'The live editing sessions this API process serves.' })
	@Permissions(PermissionsEnum.DOCS_READ)
	@Get('/live/status')
	status(): IDocumentLiveStatus {
		return this.live.status();
	}

	@ApiOperation({ summary: 'Applies an edit (a base64 Yjs update) of a live session of the page.' })
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'The edit was applied, or handed to the process that holds the session.'
	})
	@ApiResponse({
		status: HttpStatus.NOT_FOUND,
		description: 'No live session of the page is open for this connection.'
	})
	@ApiResponse({ status: HttpStatus.FORBIDDEN, description: 'The session is read-only.' })
	@Permissions(PermissionsEnum.DOCS_UPDATE)
	// Editors batch their keystrokes; this is far above what one tab sends and far below a flood.
	@Throttle({ default: { limit: 600, ttl: 60_000 } })
	@UseValidationPipe({ whitelist: true, transform: true, forbidNonWhitelisted: true })
	@HttpCode(HttpStatus.OK)
	@Post('/documents/:id/live/updates')
	update(@Param('id', UUIDValidationPipe) id: ID, @Body() input: DocumentLiveUpdateDTO): Promise<IDocumentLiveAck> {
		return this.live.applyClientUpdate(String(id), input.connectionId, input.update);
	}

	@ApiOperation({
		summary: 'Applies a cursor / presence change (a base64 y-protocols awareness update) of a live session.'
	})
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'The change was applied, or handed to the process that holds the session.'
	})
	@ApiResponse({
		status: HttpStatus.NOT_FOUND,
		description: 'No live session of the page is open for this connection.'
	})
	@Permissions(PermissionsEnum.DOCS_READ)
	@Throttle({ default: { limit: 600, ttl: 60_000 } })
	@UseValidationPipe({ whitelist: true, transform: true, forbidNonWhitelisted: true })
	@HttpCode(HttpStatus.OK)
	@Post('/documents/:id/live/awareness')
	awareness(
		@Param('id', UUIDValidationPipe) id: ID,
		@Body() input: DocumentLiveAwarenessDTO
	): Promise<IDocumentLiveAck> {
		return this.live.applyClientAwareness(String(id), input.connectionId, input.awareness);
	}
}
