import { MultiORMColumn, MultiORMEntity, TenantOrganizationBaseEntity } from '@gauzy/core';
import { MikroOrmChatCategoryRepository } from './chat.repositories';

/** `chat_category`: a named, ordered sidebar section channels are grouped under. */
@MultiORMEntity('chat_category', { mikroOrmRepository: () => MikroOrmChatCategoryRepository })
export class ChatCategory extends TenantOrganizationBaseEntity {
	@MultiORMColumn({ type: 'varchar', length: 120 })
	name!: string;

	@MultiORMColumn({ type: 'int', default: 0 })
	position!: number;
}
