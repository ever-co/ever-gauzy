import { ID, IChatFile } from '@gauzy/contracts';
import { metadataOf } from './chat-draft-uploads';

/** The dialects the files query tells apart (the one predicate the query builder cannot write portably). */
export type ChatSqlDialect = 'mysql' | 'sqlite' | 'postgres';

/** The dialect of a connection, from its driver type. */
export function chatSqlDialectOf(type: string | undefined): ChatSqlDialect {
	if (type === 'mysql' || type === 'mariadb') return 'mysql';
	if (type === 'sqlite' || type === 'better-sqlite3') return 'sqlite';
	return 'postgres';
}

/**
 * A predicate: the JSON array of strings stored as text in `column` (`["id",…]`, as `JSON.stringify` writes it)
 * names the value of `valueColumn`. For ids, which hold no quote, escape or wildcard.
 */
export function jsonListHasColumn(column: string, valueColumn: string, dialect: ChatSqlDialect): string {
	if (dialect === 'mysql') return `${column} LIKE CONCAT('%"', ${valueColumn}, '"%')`;
	return `${column} LIKE '%"' || CAST(${valueColumn} AS TEXT) || '"%'`;
}

/** The metadata of a message's document link: an object, or its JSON on SQLite, whose text column takes no object. */
export function linkMetadataOf(conversationId: ID, dialect: ChatSqlDialect): Record<string, unknown> | string {
	const metadata = { conversationId };
	return dialect === 'sqlite' ? JSON.stringify(metadata) : metadata;
}

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
	/** The document's metadata (an object, or its JSON on SQLite): the upload records a picture's size there. */
	metadata?: unknown;
}

/** The largest side a picture's recorded size may state (anything larger, or not a whole positive number, is unknown). */
export const CHAT_IMAGE_MAX_SIDE = 100_000;

/**
 * A picture's size as the Docs upload recorded it (`metadata.upload.image`: width and height as shown, orientation
 * applied), or nulls when it recorded none — a file that is not a picture, or one uploaded before sizes were read.
 */
export function imageSizeOf(metadata: unknown): { width: number | null; height: number | null } {
	const upload = metadataOf(metadataOf(metadata)['upload']);
	const image = metadataOf(upload['image']);
	const side = (value: unknown) => (typeof value === 'number' && Number.isInteger(value) && value > 0 && value <= CHAT_IMAGE_MAX_SIDE ? value : null);
	const width = side(image['width']);
	const height = side(image['height']);
	return width && height ? { width, height } : { width: null, height: null };
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
		...imageSizeOf(document.metadata),
		authorEmployeeId: link.authorEmployeeId ?? null,
		authorUserId: link.authorUserId ?? null,
		attachedAt: link.attachedAt instanceof Date ? link.attachedAt : new Date(link.attachedAt)
	};
}
