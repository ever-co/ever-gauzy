import { MikroOrmBaseEntityRepository } from '@gauzy/core';
import { AiChatConversation } from '../ai-chat-conversation.entity';

export class MikroOrmAiChatConversationRepository extends MikroOrmBaseEntityRepository<AiChatConversation> {}
