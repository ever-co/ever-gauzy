import { Controller, Get, Header, Query, Res, StreamableFile, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { FeatureFlag } from '@gauzy/common';
import { FeatureEnum, PermissionsEnum } from '@gauzy/contracts';
import { FeatureFlagGuard, PermissionGuard, Permissions, TenantPermissionGuard, UseValidationPipe } from '@gauzy/core';
import { CHAT_ROUTE_PREFIX } from '../chat.constants';
import { ChatLinkPreviewQueryDTO } from '../dto/chat.dto';
import { ChatLinkPreviewImageService } from '../link-preview/chat-link-preview-image.service';
import { ChatLinkPreviewService } from '../link-preview/chat-link-preview.service';
import { ChatAccessService } from '../services/chat-access.service';

/**
 * `/api/chat/link-preview?url=`: the preview of a link posted in chat (the chat spec FR-20), fetched by the server
 * from public addresses only and cached per tenant. Same guards as every chat route (`CHAT_VIEW`, the tenant's
 * `FEATURE_CHAT`); 404 unless `GAUZY_CHAT_LINK_PREVIEWS_ENABLED=true`. An ask can start a fetch, so the fetches one
 * person starts are budgeted by the service whatever the platform's rate limiter says (429 beyond 60 a minute), and the
 * route's own limit (`@Throttle`, 120 asks a minute) applies on top where the limiter is on (`THROTTLE_ENABLED`).
 * Answers `Cache-Control: no-store`.
 */
@ApiTags('Chat')
@ApiBearerAuth()
@UseGuards(TenantPermissionGuard, PermissionGuard, FeatureFlagGuard)
@FeatureFlag(FeatureEnum.FEATURE_CHAT)
@Permissions(PermissionsEnum.CHAT_VIEW)
@Controller(CHAT_ROUTE_PREFIX)
export class ChatLinkPreviewController {
	constructor(
		private readonly access: ChatAccessService,
		private readonly previews: ChatLinkPreviewService,
		private readonly images: ChatLinkPreviewImageService
	) {}

	@Get('/link-preview')
	@Throttle({ default: { limit: 120, ttl: 60_000 } })
	@Header('Cache-Control', 'no-store')
	@UseValidationPipe({ whitelist: true, transform: true })
	@ApiOperation({
		summary:
			'The preview of a link (title, description, image, icon): ready from the cache, pending while the server fetches it (ask again in a moment), or unavailable.'
	})
	preview(@Query() query: ChatLinkPreviewQueryDTO) {
		return this.previews.preview(this.access.caller(), query.url);
	}

	@Get('/link-preview/image')
	@Throttle({ default: { limit: 120, ttl: 60_000 } })
	@UseValidationPipe({ whitelist: true, transform: true })
	@ApiOperation({
		summary:
			'The picture of a link preview, served by the platform so the browser never loads it from the linked site: PNG, JPEG, GIF, WebP or AVIF, at most 1 MiB. 404 unless GAUZY_CHAT_LINK_PREVIEW_IMAGES_ENABLED=true, and for a link with no ready preview or no picture.'
	})
	async image(@Query() query: ChatLinkPreviewQueryDTO, @Res({ passthrough: true }) response: ChatImageResponse): Promise<StreamableFile> {
		const picture = await this.images.image(this.access.caller(), query.url);
		response.setHeader('Content-Type', picture.type);
		// The reader's own browser may keep it for the day the platform does; nothing shared may.
		response.setHeader('Cache-Control', 'private, max-age=86400');
		response.setHeader('X-Content-Type-Options', 'nosniff');
		response.setHeader('Content-Security-Policy', "default-src 'none'; sandbox");
		response.setHeader('Content-Disposition', 'inline');
		return new StreamableFile(picture.body);
	}
}

/** The part of the response the picture route sets. */
interface ChatImageResponse {
	setHeader(name: string, value: string): void;
}
