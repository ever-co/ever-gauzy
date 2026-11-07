import { ChatTaskReferenceKindEnum, ID } from '@gauzy/contracts';
import { MultiORMColumn, MultiORMEntity, TenantOrganizationBaseEntity } from '@gauzy/core';
import { MikroOrmChatTaskReferenceRepository } from './chat.repositories';

/** `chat_task_reference`: a task attached to a message (typed reference, sent card, or created from it). */
@MultiORMEntity('chat_task_reference', { mikroOrmRepository: () => MikroOrmChatTaskReferenceRepository })
export class ChatTaskReference extends TenantOrganizationBaseEntity {
	@MultiORMColumn()
	messageId!: ID;

	@MultiORMColumn()
	taskId!: ID;

	@MultiORMColumn({ type: 'varchar', length: 16, default: ChatTaskReferenceKindEnum.MENTION })
	kind!: ChatTaskReferenceKindEnum;
}
