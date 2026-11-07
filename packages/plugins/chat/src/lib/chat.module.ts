import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MentionModule, RolePermissionModule } from '@gauzy/core';
import { ChatConversationController } from './controllers/chat-conversation.controller';
import { ChatMessageController } from './controllers/chat-message.controller';
import { ChatResolver } from './graphql/chat.resolver';
import { ChatCategory } from './entities/chat-category.entity';
import { ChatConversation } from './entities/chat-conversation.entity';
import { ChatMember } from './entities/chat-member.entity';
import { ChatMessage } from './entities/chat-message.entity';
import { ChatTaskReference } from './entities/chat-task-reference.entity';
import { ChatThreadFollow } from './entities/chat-thread-follow.entity';
import { ChatRealtime } from './realtime/chat-realtime';
import { ChatAccessService } from './services/chat-access.service';
import { ChatConversationService } from './services/chat-conversation.service';
import { ChatMessageService } from './services/chat-message.service';
import { ChatNotifierService } from './services/chat-notifier.service';

/** Every table the plugin owns (its migrations create them). */
export const CHAT_ENTITIES = [ChatCategory, ChatConversation, ChatMember, ChatMessage, ChatThreadFollow, ChatTaskReference];

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
		CqrsModule
	],
	controllers: [ChatConversationController, ChatMessageController],
	// The resolver is listed here as well as in the plugin's `extensions`: a resolver only the plugin metadata names is
	// never registered, and the schema would advertise fields nothing resolves.
	providers: [ChatAccessService, ChatRealtime, ChatNotifierService, ChatConversationService, ChatMessageService, ChatResolver],
	exports: [ChatAccessService, ChatConversationService, ChatMessageService, ChatRealtime]
})
export class ChatModule {}
