import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { SearchPluginModule } from '@gauzy/plugin-search';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MentionModule, RolePermissionModule, TaskModule } from '@gauzy/core';
import { ChatConversationController } from './controllers/chat-conversation.controller';
import { ChatLinkPreviewController } from './controllers/chat-link-preview.controller';
import { ChatMessageController } from './controllers/chat-message.controller';
import { ChatResolver } from './graphql/chat.resolver';
import { ChatCategory } from './entities/chat-category.entity';
import { ChatConversation } from './entities/chat-conversation.entity';
import { ChatLinkPreview } from './entities/chat-link-preview.entity';
import { ChatMember } from './entities/chat-member.entity';
import { ChatMessage } from './entities/chat-message.entity';
import { ChatTaskReference } from './entities/chat-task-reference.entity';
import { ChatThreadFollow } from './entities/chat-thread-follow.entity';
import { CHAT_LINK_PREVIEWS_QUEUED, ChatLinkPreviewModule, ChatLinkPreviewQueueModule } from './link-preview/chat-link-preview.module';
import { ChatRealtime } from './realtime/chat-realtime';
import { ChatAccessService } from './services/chat-access.service';
import { ChatConversationService } from './services/chat-conversation.service';
import { ChatMessageService } from './services/chat-message.service';
import { ChatSearchService } from './services/chat-search.service';
import { ChatNotifierService } from './services/chat-notifier.service';

/** Every table the plugin owns (its migrations create them). */
export const CHAT_ENTITIES = [ChatCategory, ChatConversation, ChatMember, ChatMessage, ChatThreadFollow, ChatTaskReference, ChatLinkPreview];

/**
 * The chat module (`@gauzy/plugin-chat`), loaded only when `GAUZY_CHAT_ENABLED=true`.
 */
@Module({
	imports: [
		TypeOrmModule.forFeature(CHAT_ENTITIES),
		MikroOrmModule.forFeature(CHAT_ENTITIES),
		// The tenant and permission guards of the routes need the role permissions.
		RolePermissionModule,
		// Mentions go through the platform's mention service; message notifications through the CQRS bus.
		MentionModule,
		CqrsModule,
		// Typed `KEY-number` references are resolved by the platform's task service; a task made from a message by its command.
		TaskModule,
		// The search route goes through the platform's search plugin (it ships the `chat_message` declaration).
		SearchPluginModule,
		// Link previews: the cache and its service; their queue and worker only where previews are on and a queue
		// root exists (else the fetches run inline, see `ChatLinkPreviewService`).
		ChatLinkPreviewModule,
		...(CHAT_LINK_PREVIEWS_QUEUED ? [ChatLinkPreviewQueueModule] : [])
	],
	controllers: [ChatConversationController, ChatMessageController, ChatLinkPreviewController],
	// The resolver is listed here as well as in the plugin's `extensions`: a resolver only the plugin metadata names is
	// never registered, and the schema would advertise fields nothing resolves.
	providers: [ChatAccessService, ChatRealtime, ChatNotifierService, ChatConversationService, ChatMessageService, ChatSearchService, ChatResolver],
	exports: [ChatAccessService, ChatConversationService, ChatMessageService, ChatRealtime]
})
export class ChatModule {}
