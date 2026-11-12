import { ID } from '@gauzy/contracts';
import { MultiORMColumn, MultiORMEntity, TenantOrganizationBaseEntity } from '@gauzy/core';
import { MikroOrmChatAttachmentDraftRepository } from './chat.repositories';

/**
 * `chat_attachment_draft`: a file uploaded for a message that no message carries yet — the Docs upload of a chat
 * composer (`Document { kind: FILE, source: CHAT }`), recorded when the upload is stored and dropped when a send or
 * an edit attaches it. A draft its uploader discards, or that is still here after the draft TTL (24 h by default), is
 * swept: the document and its stored bytes go (see `ChatDraftUploadService`). A file already sent never has a row.
 */
@MultiORMEntity('chat_attachment_draft', { mikroOrmRepository: () => MikroOrmChatAttachmentDraftRepository })
export class ChatAttachmentDraft extends TenantOrganizationBaseEntity {
	/** The uploaded document (`document.id`). */
	@MultiORMColumn()
	documentId!: ID;

	/** The uploader: the only one who may attach or discard it. */
	@MultiORMColumn()
	userId!: ID;
}
