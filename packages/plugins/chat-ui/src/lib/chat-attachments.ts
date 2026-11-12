import { CHAT_MESSAGE_MAX_ATTACHMENTS, CHAT_MESSAGE_MAX_LENGTH, IChatFile } from '@gauzy/contracts';
import type { ChatUploadAnswer } from './services/chat-ui.service';

/** A file the composer holds for the next message: being stored, stored (with its document), or refused. */
export interface PendingAttachment {
	/** Tells two picks of one file apart. */
	key: number;
	name: string;
	size: number;
	mimeType: string;
	status: 'uploading' | 'ready' | 'failed';
	documentId: string | null;
	/** Why the platform refused it (its own words), when it did. */
	error: string | null;
}

/** Whether a file is shown as a picture (anything else is a link to the file). */
export function isImageFile(mimeType: string | null | undefined): boolean {
	return typeof mimeType === 'string' && /^image\/(png|jpe?g|gif|webp|avif|bmp)$/i.test(mimeType.trim());
}

/** A size for people: `512 B`, `12 KB`, `3.4 MB`; empty when unknown. */
export function fileSizeLabel(bytes: number | null | undefined): string {
	if (bytes === null || bytes === undefined || !Number.isFinite(bytes) || bytes < 0) return '';
	if (bytes < 1024) return `${Math.round(bytes)} B`;
	const units = ['KB', 'MB', 'GB'];
	let value = bytes / 1024;
	let unit = 0;
	while (value >= 1024 && unit < units.length - 1) {
		value /= 1024;
		unit += 1;
	}
	return `${value >= 10 ? Math.round(value) : Math.round(value * 10) / 10} ${units[unit]}`;
}

/** The documents of the attachments that are stored, in the order picked. */
export function readyAttachmentIds(attachments: readonly PendingAttachment[]): string[] {
	return attachments.filter((item) => item.status === 'ready' && !!item.documentId).map((item) => String(item.documentId));
}

/**
 * The body a message with files was sent with while the platform needed a body for every message: a message of files
 * alone carried their names (`📎 report.pdf, chart.png`), kept within the length a message holds.
 *
 * @deprecated The composer sends a message of files only with an empty body now (the platform records the files'
 * names itself, `attachmentNames`); kept for callers outside the composer.
 */
export function bodyWithAttachments(text: string, attachments: readonly PendingAttachment[]): string {
	if (text.trim()) return text;
	const names = attachments.filter((item) => item.status === 'ready').map((item) => item.name.replace(/[\r\n]+/g, ' ').trim() || 'file');
	if (!names.length) return text;
	const body = `📎 ${names.join(', ')}`;
	return body.length > CHAT_MESSAGE_MAX_LENGTH ? `${body.slice(0, CHAT_MESSAGE_MAX_LENGTH - 1)}…` : body;
}

/** How many more files the next message can take. */
export function attachmentRoom(attachments: readonly PendingAttachment[]): number {
	return Math.max(0, CHAT_MESSAGE_MAX_ATTACHMENTS - attachments.filter((item) => item.status !== 'failed').length);
}

/** The stored document of a one-file upload, or why it was refused. */
export function uploadOutcome(answer: ChatUploadAnswer | null | undefined): { documentId: string } | { error: string } {
	const document = answer?.results?.[0]?.document;
	if (document?.id) return { documentId: String(document.id) };
	const rejected = answer?.rejected?.[0];
	return { error: rejected?.message || rejected?.code || 'The file was refused.' };
}

/** The files a drop or a paste carries (text and links carry none). */
export function filesOfTransfer(transfer: Pick<DataTransfer, 'files'> | null | undefined): File[] {
	const list = transfer?.files;
	if (!list || !list.length) return [];
	return Array.from(list).filter((file) => !!file && file.size >= 0);
}

/** What a message's attachments show: the known files (pictures and others apart) and how many are not known (yet). */
export interface MessageAttachments {
	images: IChatFile[];
	files: IChatFile[];
	unknown: number;
}

/** The attachments of a message, from the conversation's files read so far. */
export function messageAttachments(documentIds: readonly string[] | null | undefined, known: ReadonlyMap<string, IChatFile>): MessageAttachments {
	const result: MessageAttachments = { images: [], files: [], unknown: 0 };
	for (const id of documentIds ?? []) {
		const file = known.get(String(id));
		if (!file) result.unknown += 1;
		else if (isImageFile(file.mimeType) && (file.thumbUrl || file.fileUrl)) result.images.push(file);
		else result.files.push(file);
	}
	return result;
}

/** The most room a picture of a message takes (CSS pixels): the box of its thumbnail. */
export const CHAT_IMAGE_MAX_BOX = { width: 320, height: 240 } as const;

/**
 * The size a picture is shown at, from the width and height the platform read at its upload, fitted into
 * {@link CHAT_IMAGE_MAX_BOX} (never enlarged): the space it reserves before it loads, so the conversation does not
 * jump. Null when the size is not known (the picture then takes its space as it loads, as before).
 */
export function imageBox(file: Pick<IChatFile, 'width' | 'height'>, max: { width: number; height: number } = CHAT_IMAGE_MAX_BOX): { width: number; height: number } | null {
	const width = Number(file.width);
	const height = Number(file.height);
	if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) return null;
	const scale = Math.min(1, max.width / width, max.height / height);
	return { width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)) };
}
