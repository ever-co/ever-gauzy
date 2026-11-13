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
	/** A picture's preview, read from the picked file itself (an object URL: released when the file leaves the composer). */
	previewUrl?: string | null;
	/** The picked file itself, kept while it waits in the composer: what its preview popup shows. */
	file?: File | null;
}

/** What the preview popup needs of a file: a stored file of a message, or one still waiting in the composer. */
export interface PreviewableFile {
	/** The stored document, when it is one: its bytes can then be read through the API if its address does not load. */
	documentId?: string | null;
	name: string;
	mimeType?: string | null;
	fileSize?: number | null;
	fileUrl?: string | null;
	thumbUrl?: string | null;
}

/** An address of the picked file for its preview popup (null where object URLs are not available). */
export function objectUrlOf(file: Blob | null | undefined): string | null {
	if (!file || typeof URL === 'undefined' || typeof URL.createObjectURL !== 'function') return null;
	try {
		return URL.createObjectURL(file);
	} catch {
		return null;
	}
}

/** Lets go of an address made by {@link objectUrlOf}. */
export function releaseObjectUrl(url: string | null | undefined): void {
	if (url && typeof URL !== 'undefined' && typeof URL.revokeObjectURL === 'function') URL.revokeObjectURL(url);
}

/** A preview of a picked picture, straight from the file (null for other files, or where object URLs are not available). */
export function previewUrlOf(file: Pick<File, 'type'>): string | null {
	if (!isImageFile(file.type) || typeof URL === 'undefined' || typeof URL.createObjectURL !== 'function') return null;
	try {
		return URL.createObjectURL(file as File);
	} catch {
		return null;
	}
}

/** Lets go of the previews of files that left the composer. */
export function releasePreviews(attachments: readonly PendingAttachment[]): void {
	if (typeof URL === 'undefined' || typeof URL.revokeObjectURL !== 'function') return;
	for (const item of attachments) {
		if (item.previewUrl) URL.revokeObjectURL(item.previewUrl);
	}
}

/** Whether a file is shown as a picture (anything else is a link to the file). */
export function isImageFile(mimeType: string | null | undefined): boolean {
	return typeof mimeType === 'string' && /^image\/(png|jpe?g|gif|webp|avif|bmp)$/i.test(mimeType.trim());
}

/** How a file is shown in the preview popup: as itself where a browser can show it, else as its name alone. */
export type FilePreviewKind = 'image' | 'video' | 'audio' | 'pdf' | 'none';

/**
 * The preview a file gets. Only a file with an address of its own is shown as itself: http(s) for a stored file,
 * or the page's own `blob:` address of a file still waiting in the composer.
 */
export function previewKindOf(file: Pick<PreviewableFile, 'mimeType' | 'fileUrl' | 'thumbUrl'>): FilePreviewKind {
	const mime = (file.mimeType ?? '').trim().toLowerCase();
	const isWeb = (url: string | null | undefined) => typeof url === 'string' && /^(https?:\/\/|blob:)/i.test(url.trim());
	if (isImageFile(mime)) return isWeb(file.fileUrl) || isWeb(file.thumbUrl) ? 'image' : 'none';
	if (!isWeb(file.fileUrl)) return 'none';
	if (/^video\/(mp4|webm|ogg)$/.test(mime)) return 'video';
	if (/^audio\/(mpeg|mp3|ogg|wav|webm|aac|mp4|x-m4a)$/.test(mime)) return 'audio';
	if (mime === 'application/pdf') return 'pdf';
	return 'none';
}

/** Whether a click is a plain one (no modifier, main button): any other keeps the link's own way (a new tab, a download). */
export function isPlainClick(event: Pick<MouseEvent, 'button' | 'ctrlKey' | 'metaKey' | 'shiftKey' | 'altKey'>): boolean {
	return event.button === 0 && !event.ctrlKey && !event.metaKey && !event.shiftKey && !event.altKey;
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
export const CHAT_IMAGE_MAX_BOX = { width: 550, height: 350 } as const;

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
