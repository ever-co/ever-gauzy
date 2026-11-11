import { Controller, Get, Header, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { FeatureFlag } from '@gauzy/common';
import { FeatureEnum, PermissionsEnum } from '@gauzy/contracts';
import { FeatureFlagGuard, PermissionGuard, Permissions, TenantPermissionGuard, UseValidationPipe } from '@gauzy/core';
import { CHAT_ROUTE_PREFIX } from '../chat.constants';
import { ChatLinkPreviewQueryDTO } from '../dto/chat.dto';
import { ChatLinkPreviewService } from '../link-preview/chat-link-preview.service';
import { ChatAccessService } from '../services/chat-access.service';

/**
 * `/api/chat/link-preview?url=`: the preview of a link posted in chat (the chat spec FR-20), fetched by the server
 * from public addresses only and cached per tenant. Same guards as every chat route (`CHAT_VIEW`, the tenant's
 * `FEATURE_CHAT`); 404 unless `GAUZY_CHAT_LINK_PREVIEWS_ENABLED=true`. Rate-limited per user, since an ask can start
 * a fetch. Answers `Cache-Control: no-store`.
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
		private readonly previews: ChatLinkPreviewService
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
}
