import { Module } from '@nestjs/common';
import { RolePermissionModule } from '@gauzy/core';
import { AiChatController } from './ai-chat.controller';
import { AiChatService } from './ai-chat.service';
import { AiProviderCredentialModule } from './credentials/ai-provider-credential.module';

@Module({
	imports: [RolePermissionModule, AiProviderCredentialModule],
	controllers: [AiChatController],
	providers: [AiChatService],
	exports: [AiChatService]
})
export class AiChatModule {}
