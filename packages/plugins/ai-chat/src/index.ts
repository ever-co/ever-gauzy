/*
 * Public API Surface of @gauzy/plugin-ai-chat
 */
export { AiChatPlugin } from './lib/ai-chat.plugin';
export { AiChatModule } from './lib/ai-chat.module';
export { AiChatService } from './lib/ai-chat.service';
export { AiChatController } from './lib/ai-chat.controller';

// Provider SPI — implemented by @gauzy/plugin-ai-provider-* plugins
export { AiProviderRegistry } from './lib/provider-registry';
export { BaseAiProviderPlugin } from './lib/base-ai-provider.plugin';
export type { IAiChatProviderDefinition, IAiProviderCredentials } from './lib/provider.types';
export { importEsm, loadAiSdk } from './lib/esm-loader';

// BYOK credentials
export { AiProviderCredential } from './lib/credentials/ai-provider-credential.entity';
export { AiProviderCredentialService } from './lib/credentials/ai-provider-credential.service';
export { AiProviderCredentialModule } from './lib/credentials/ai-provider-credential.module';

// Chat history (per-user conversations)
export { AiChatConversation } from './lib/conversations/ai-chat-conversation.entity';
export { AiChatConversationService } from './lib/conversations/ai-chat-conversation.service';
export { AiChatConversationModule } from './lib/conversations/ai-chat-conversation.module';
