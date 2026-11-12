import { Injectable } from '@nestjs/common';
import { MikroOrmBaseEntityRepository } from '@gauzy/core';
import type { ChatCategory } from './chat-category.entity';
import type { ChatConversation } from './chat-conversation.entity';
import type { ChatMember } from './chat-member.entity';
import type { ChatMessage } from './chat-message.entity';
import type { ChatThreadFollow } from './chat-thread-follow.entity';
import type { ChatTaskReference } from './chat-task-reference.entity';
import type { ChatAttachmentDraft } from './chat-attachment-draft.entity';
import type { ChatLinkPreview } from './chat-link-preview.entity';
import type { ChatWebhook } from './chat-webhook.entity';
import type { ChatWebhookInteraction } from './chat-webhook-interaction.entity';

/** The MikroORM repositories the entities name (the services themselves run on TypeORM's `DataSource`). */
@Injectable()
export class MikroOrmChatCategoryRepository extends MikroOrmBaseEntityRepository<ChatCategory> {}

@Injectable()
export class MikroOrmChatConversationRepository extends MikroOrmBaseEntityRepository<ChatConversation> {}

@Injectable()
export class MikroOrmChatMemberRepository extends MikroOrmBaseEntityRepository<ChatMember> {}

@Injectable()
export class MikroOrmChatMessageRepository extends MikroOrmBaseEntityRepository<ChatMessage> {}

@Injectable()
export class MikroOrmChatThreadFollowRepository extends MikroOrmBaseEntityRepository<ChatThreadFollow> {}

@Injectable()
export class MikroOrmChatTaskReferenceRepository extends MikroOrmBaseEntityRepository<ChatTaskReference> {}

@Injectable()
export class MikroOrmChatAttachmentDraftRepository extends MikroOrmBaseEntityRepository<ChatAttachmentDraft> {}

@Injectable()
export class MikroOrmChatLinkPreviewRepository extends MikroOrmBaseEntityRepository<ChatLinkPreview> {}

@Injectable()
export class MikroOrmChatWebhookRepository extends MikroOrmBaseEntityRepository<ChatWebhook> {}

@Injectable()
export class MikroOrmChatWebhookInteractionRepository extends MikroOrmBaseEntityRepository<ChatWebhookInteraction> {}
