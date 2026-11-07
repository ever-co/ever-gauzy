import { ID, IChatFile } from '@gauzy/contracts';

/** A document link of a message as the files query reads it (raw: the link's columns and the message's author). */
export interface IChatFileLink {
	documentId: ID;
	messageId: ID;
	conversationId: ID;
	attachedAt: Date | string;
	authorEmployeeId?: ID | null;
	authorUserId?: ID | null;
}

/** The document columns the files pane shows (never the storage key: the URL is what a client opens). */
export interface IChatFileDocument {
	id: ID;
	name?: string | null;
	originalFilename?: string | null;
	mimeType?: string | null;
	fileSize?: number | string | null;
	status?: string | null;
	fileUrl?: string | null;
	thumbUrl?: string | null;
}

/** One file of the pane: the link's place and author, the document's name and kind; null when the document is gone. */
export function chatFileOf(link: IChatFileLink, document: IChatFileDocument | null | undefined): IChatFile | null {
	if (!document) return null;
	const size = document.fileSize === null || document.fileSize === undefined ? null : Number(document.fileSize);
	return {
		documentId: document.id,
		messageId: link.messageId,
		conversationId: link.conversationId,
		name: (document.name ?? '').trim() || (document.originalFilename ?? '').trim() || 'file',
		originalFilename: document.originalFilename ?? null,
		mimeType: document.mimeType ?? null,
		fileSize: size !== null && Number.isFinite(size) ? size : null,
		status: document.status ?? null,
		fileUrl: document.fileUrl ?? null,
		thumbUrl: document.thumbUrl ?? null,
		authorEmployeeId: link.authorEmployeeId ?? null,
		authorUserId: link.authorUserId ?? null,
		attachedAt: link.attachedAt instanceof Date ? link.attachedAt : new Date(link.attachedAt)
	};
}
