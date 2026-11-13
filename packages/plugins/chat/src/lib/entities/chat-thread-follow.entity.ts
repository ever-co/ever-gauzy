import { ID } from '@gauzy/contracts';
import { MultiORMColumn, MultiORMEntity, TenantOrganizationBaseEntity } from '@gauzy/core';
import { MikroOrmChatThreadFollowRepository } from './chat.repositories';

/** `chat_thread_follow`: an employee following a thread (its root author and every replier, or by choice). */
@MultiORMEntity('chat_thread_follow', { mikroOrmRepository: () => MikroOrmChatThreadFollowRepository })
export class ChatThreadFollow extends TenantOrganizationBaseEntity {
	@MultiORMColumn()
	rootMessageId!: ID;

	@MultiORMColumn()
	employeeId!: ID;

	@MultiORMColumn()
	userId!: ID;

	@MultiORMColumn({ type: 'int', default: 0 })
	unreadReplies!: number;

	@MultiORMColumn({ nullable: true })
	lastReadReplyAt?: Date;
}
