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
export type { IAiChatModelList, IAiChatProviderDefinition, IAiProviderCredentials } from './lib/provider.types';
export { importEsm, loadAiSdk } from './lib/esm-loader';

// Chat-tool extension SPI — other plugins (e.g. @gauzy/plugin-docs) contribute per-turn tools
export { AiChatToolRegistry } from './lib/tools/tool-registry';
export type {
	AiChatDataPartWriter,
	AiChatToolFactory,
	IAiChatDataPart,
	IAiChatToolContext,
	IAiChatToolContribution
} from './lib/tools/tool-registry';
export { createDeferredDataPartWriter } from './lib/tools/data-parts';
export type { IDeferredDataPartWriter } from './lib/tools/data-parts';

// Shared plumbing for provider model catalogues: bounded fetch, credential-keyed cache, fail-open.
export {
	createCatalogueCache,
	credentialCacheKey,
	fetchCatalogueJson,
	keyedCatalogue,
	mergeCatalogue,
	prettifyModelId,
	publicCatalogue
} from './lib/model-catalogue';
export type { ICatalogueCache, ICatalogueResult } from './lib/model-catalogue';

// Rate-limit classification + the envelope the chat client parses out of the stream's error channel.
export { RATE_LIMIT_CODE, isRateLimitError, rateLimitRetryAfter, buildRateLimitEnvelope } from './lib/rate-limit';
export type { IAiChatRateLimitEnvelope } from './lib/rate-limit';

// BYOK credentials
export { AiProviderCredential } from './lib/credentials/ai-provider-credential.entity';
export { AiProviderCredentialService } from './lib/credentials/ai-provider-credential.service';
export { AiProviderCredentialModule } from './lib/credentials/ai-provider-credential.module';

// Chat attachments — the event `@gauzy/plugin-docs` captures into the Documents hub.
// 🛑 `AiChatAttachmentSavedEvent` is resolved BY NAME at runtime by that plugin's
// `ChatCaptureSubscriber`; removing or renaming this export silently disables chat capture.
export { AiChatAttachmentSavedEvent } from './lib/attachments/ai-chat-attachment.event';
export type {
	IAiChatAttachmentFile,
	IAiChatAttachmentSavedPayload
} from './lib/attachments/ai-chat-attachment.event';
export { AiChatAttachmentService, MAX_ATTACHMENT_BYTES } from './lib/attachments/ai-chat-attachment.service';
export type { IAiChatAttachmentResult } from './lib/attachments/ai-chat-attachment.service';

// Chat history (per-user conversations)
export { AiChatConversation } from './lib/conversations/ai-chat-conversation.entity';
export { AiChatConversationService } from './lib/conversations/ai-chat-conversation.service';
export { AiChatConversationModule } from './lib/conversations/ai-chat-conversation.module';
