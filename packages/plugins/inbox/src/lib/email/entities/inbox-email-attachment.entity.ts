import { ID } from '@gauzy/contracts';
import { MultiORMColumn, MultiORMEntity, TenantOrganizationBaseEntity } from '@gauzy/core';
import { MikroOrmInboxEmailAttachmentRepository } from './inbox-email.repositories';

/**
 * `inbox_email_attachment` (plan 04 §2): an attachment (or inline part) of a stored message, its bytes in FileStorage.
 * Downloads are always served as attachments with `nosniff`, never rendered inline.
 */
@MultiORMEntity('inbox_email_attachment', { mikroOrmRepository: () => MikroOrmInboxEmailAttachmentRepository })
export class InboxEmailAttachment extends TenantOrganizationBaseEntity {
	@MultiORMColumn()
	emailId!: ID;

	@MultiORMColumn({ type: 'varchar', length: 255 })
	filename!: string;

	@MultiORMColumn({ type: 'varchar', length: 255, nullable: true })
	contentType?: string | null;

	@MultiORMColumn({ default: 0 })
	size!: number;

	@MultiORMColumn({ type: 'varchar', length: 64, nullable: true })
	sha256?: string | null;

	@MultiORMColumn({ type: 'varchar', length: 512 })
	storageKey!: string;

	@MultiORMColumn({ type: 'varchar', length: 32, nullable: true })
	storageProvider?: string | null;

	@MultiORMColumn({ type: 'varchar', length: 255, nullable: true })
	contentId?: string | null;

	@MultiORMColumn({ default: false })
	isInline!: boolean;

	/** The Docs `Document` it was saved as ("Save to Documents"). */
	@MultiORMColumn({ nullable: true })
	savedDocumentId?: ID;
}
