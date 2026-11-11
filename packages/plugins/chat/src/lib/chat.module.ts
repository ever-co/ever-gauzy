import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { SearchPluginModule } from '@gauzy/plugin-search';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MentionModule, RolePermissionModule , TaskModule } from '@gauzy/core';
import { ChatConversationController } from './controllers/chat-conversation.controller';
import { ChatMessageController } from './controllers/chat-message.controller';
import { ChatWebhookController } from './controllers/chat-webhook.controller';
import { ChatWebhookReceiveController } from './controllers/chat-webhook-receive.controller';
import { ChatResolver } from './graphql/chat.resolver';
import { ChatCategory } from './entities/chat-category.entity';
import { ChatConversation } from './entities/chat-conversation.entity';
import { ChatMember } from './entities/chat-member.entity';
import { ChatMessage } from './entities/chat-message.entity';
import { ChatTaskReference } from './entities/chat-task-reference.entity';
import { ChatThreadFollow } from './entities/chat-thread-follow.entity';
import { ChatWebhook } from './entities/chat-webhook.entity';
import { ChatWebhookInteraction } from './entities/chat-webhook-interaction.entity';
import { ChatRealtime } from './realtime/chat-realtime';
import { ChatAccessService } from './services/chat-access.service';
import { ChatConversationService } from './services/chat-conversation.service';
import { ChatMessageService } from './services/chat-message.service';
import { ChatSearchService } from './services/chat-search.service';
import { ChatNotifierService } from './services/chat-notifier.service';
import { ChatAppMessageWriter } from './webhooks/chat-app-message.writer';
import { ChatInteractionService } from './webhooks/chat-interaction.service';
import { ChatInteractionTransport } from './webhooks/chat-interaction-transport';
import { ChatWebhookRateLimiter } from './webhooks/chat-webhook-rate-limiter';
import { ChatWebhookService } from './webhooks/chat-webhook.service';

/** Every table the plugin owns (its migrations create them). */
export const CHAT_ENTITIES = [ChatCategory, ChatConversation, ChatMember, ChatMessage, ChatThreadFollow, ChatTaskReference, ChatWebhook, ChatWebhookInteraction];

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
		SearchPluginModule
	],
	// The webhook routes answer 404 unless `GAUZY_CHAT_WEBHOOKS_ENABLED=true` (read per request by their services).
	controllers: [ChatConversationController, ChatMessageController, ChatWebhookController, ChatWebhookReceiveController],
	// The resolver is listed here as well as in the plugin's `extensions`: a resolver only the plugin metadata names is
	// never registered, and the schema would advertise fields nothing resolves.
	providers: [
		ChatAccessService,
		ChatRealtime,
		ChatNotifierService,
		ChatConversationService,
		ChatMessageService,
		ChatSearchService,
		ChatResolver,
		ChatAppMessageWriter,
		ChatWebhookRateLimiter,
		ChatInteractionTransport,
		ChatWebhookService,
		ChatInteractionService
	],
	exports: [ChatAccessService, ChatConversationService, ChatMessageService, ChatRealtime]
})
export class ChatModule {}
