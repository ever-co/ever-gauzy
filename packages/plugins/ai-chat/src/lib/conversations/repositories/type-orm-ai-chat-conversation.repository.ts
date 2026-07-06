import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AiChatConversation } from '../ai-chat-conversation.entity';

@Injectable()
export class TypeOrmAiChatConversationRepository extends Repository<AiChatConversation> {
	constructor(@InjectRepository(AiChatConversation) readonly repository: Repository<AiChatConversation>) {
		super(repository.target, repository.manager, repository.queryRunner);
	}
}
