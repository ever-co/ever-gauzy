import { MikroOrmModule } from '@mikro-orm/nestjs';
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RolePermissionModule } from '@gauzy/core';
import { AiChatConversation } from './ai-chat-conversation.entity';
import { AiChatConversationController } from './ai-chat-conversation.controller';
import { AiChatConversationService } from './ai-chat-conversation.service';
import { TypeOrmAiChatConversationRepository } from './repositories/type-orm-ai-chat-conversation.repository';

/**
 * AiChatConversationModule
 *
 * Persistence + REST endpoints for per-user AI chat conversation history.
 * Exports {@link AiChatConversationService} for the chat engine (which
 * calls `saveTurn` from stream-finished callbacks with an explicit
 * tenant/user scope — see the service JSDoc).
 */
@Module({
	controllers: [AiChatConversationController],
	imports: [
		TypeOrmModule.forFeature([AiChatConversation]),
		MikroOrmModule.forFeature([AiChatConversation]),
		RolePermissionModule
	],
	providers: [AiChatConversationService, TypeOrmAiChatConversationRepository],
	exports: [AiChatConversationService]
})
export class AiChatConversationModule {}
