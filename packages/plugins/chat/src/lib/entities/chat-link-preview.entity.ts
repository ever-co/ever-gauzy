import { ChatLinkPreviewStatusEnum } from '@gauzy/contracts';
import { ColumnIndex, MultiORMColumn, MultiORMEntity, TenantOrganizationBaseEntity } from '@gauzy/core';
import { MikroOrmChatLinkPreviewRepository } from './chat.repositories';

/**
 * `chat_link_preview`: the cached preview of a link posted in chat, one row per tenant and link (`urlHash`, the
 * SHA-256 of the normalized `url`; unique with `tenantId`). Kept per tenant, so one tenant's links never show in, or
 * are timed through, another's. The organization is left empty: a preview is what a public page says about itself,
 * the same for every organization of the tenant.
 *
 * `data` is the preview as JSON text (the same on the three databases): sanitized plain text and `https:` URLs only,
 * never the page itself. `fetchedAt` is when the page was last fetched (empty while the first fetch is pending); the
 * refresh policy reads it with `status`.
 */
@MultiORMEntity('chat_link_preview', { mikroOrmRepository: () => MikroOrmChatLinkPreviewRepository })
// The migration's unique key, stated on the entity too: a schema built from the entities (`DB_SYNCHRONIZE`) has it.
@ColumnIndex('UQ_chat_link_preview_tenant_url_hash', ['tenantId', 'urlHash'], { unique: true })
export class ChatLinkPreview extends TenantOrganizationBaseEntity {
	@MultiORMColumn({ type: 'varchar', length: 64 })
	urlHash!: string;

	@MultiORMColumn({ type: 'text' })
	url!: string;

	@MultiORMColumn({ type: 'varchar', length: 16, default: ChatLinkPreviewStatusEnum.PENDING })
	status!: ChatLinkPreviewStatusEnum;

	/** JSON `ILinkPreviewData`. */
	@MultiORMColumn({ type: 'text', nullable: true })
	data?: string | null;

	@MultiORMColumn({ nullable: true })
	fetchedAt?: Date;
}
