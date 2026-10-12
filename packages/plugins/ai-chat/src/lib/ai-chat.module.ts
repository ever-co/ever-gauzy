import { Module } from '@nestjs/common';
import { EventBusModule, RolePermissionModule } from '@gauzy/core';
import { AiChatController } from './ai-chat.controller';
import { AiChatService } from './ai-chat.service';
import { AiChatAttachmentService } from './attachments/ai-chat-attachment.service';
import { AiProviderCredentialModule } from './credentials/ai-provider-credential.module';
import { AiChatConversationModule } from './conversations/ai-chat-conversation.module';

@Module({
	imports: [
		RolePermissionModule,
		// Provides the core RxJS EventBus the attachment service publishes
		// `AiChatAttachmentSavedEvent` on (consumed by @gauzy/plugin-docs' chat capture).
		EventBusModule,
		AiProviderCredentialModule,
		AiChatConversationModule
	],
	controllers: [AiChatController],
	providers: [AiChatService, AiChatAttachmentService],
	exports: [AiChatService, AiChatAttachmentService]
})
export class AiChatModule {}
