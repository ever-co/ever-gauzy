import { CHAT_MESSAGE_MAX_ATTACHMENTS, CHAT_MESSAGE_MAX_LENGTH, IChatFile } from '@gauzy/contracts';
import {
	attachmentRoom,
	bodyWithAttachments,
	fileSizeLabel,
	filesOfTransfer,
	imageBox,
	isImageFile,
	messageAttachments,
	PendingAttachment,
	readyAttachmentIds,
	uploadOutcome
} from './chat-attachments';

function pending(key: number, status: PendingAttachment['status'], name = `file-${key}.pdf`): PendingAttachment {
	return { key, name, size: 10, mimeType: 'application/pdf', status, documentId: status === 'ready' ? `doc-${key}` : null, error: null };
}

function file(documentId: string, mimeType: string | null, urls: Partial<Pick<IChatFile, 'fileUrl' | 'thumbUrl'>> = { fileUrl: `https://files.example/${documentId}` }): IChatFile {
	return { documentId, messageId: 'm1', conversationId: 'c1', name: `${documentId}.bin`, mimeType, attachedAt: new Date(), ...urls };
}

describe('chat attachments', () => {
	it('shows common pictures inline, nothing else (no SVG: it can carry script)', () => {
		expect(isImageFile('image/png')).toBe(true);
		expect(isImageFile('IMAGE/JPEG')).toBe(true);
		expect(isImageFile('image/webp')).toBe(true);
		expect(isImageFile('image/svg+xml')).toBe(false);
		expect(isImageFile('application/pdf')).toBe(false);
		expect(isImageFile(null)).toBe(false);
	});

	it('writes sizes for people', () => {
		expect(fileSizeLabel(512)).toBe('512 B');
		expect(fileSizeLabel(1536)).toBe('1.5 KB');
		expect(fileSizeLabel(25 * 1024)).toBe('25 KB');
		expect(fileSizeLabel(3.44 * 1024 * 1024)).toBe('3.4 MB');
		expect(fileSizeLabel(null)).toBe('');
		expect(fileSizeLabel(-1)).toBe('');
	});

	it('sends only the stored files, in the order picked', () => {
		expect(readyAttachmentIds([pending(1, 'ready'), pending(2, 'uploading'), pending(3, 'failed'), pending(4, 'ready')])).toEqual(['doc-1', 'doc-4']);
	});

	it('gives a message of files alone their names as its text, and keeps a text that was written', () => {
		const files = [pending(1, 'ready', 'report.pdf'), pending(2, 'ready', 'chart\n.png'), pending(3, 'failed', 'gone.txt')];
		expect(bodyWithAttachments('', files)).toBe('📎 report.pdf, chart .png');
		expect(bodyWithAttachments('Here you go', files)).toBe('Here you go');
		expect(bodyWithAttachments('', [pending(1, 'failed')])).toBe('');
		const long = bodyWithAttachments('', [pending(1, 'ready', 'x'.repeat(CHAT_MESSAGE_MAX_LENGTH + 10))]);
		expect(long.length).toBe(CHAT_MESSAGE_MAX_LENGTH);
	});

	it('counts the room left for files, a refused one taking none', () => {
		expect(attachmentRoom([])).toBe(CHAT_MESSAGE_MAX_ATTACHMENTS);
		expect(attachmentRoom([pending(1, 'ready'), pending(2, 'uploading'), pending(3, 'failed')])).toBe(CHAT_MESSAGE_MAX_ATTACHMENTS - 2);
		const full = Array.from({ length: CHAT_MESSAGE_MAX_ATTACHMENTS + 1 }, (_, index) => pending(index, 'ready'));
		expect(attachmentRoom(full)).toBe(0);
	});

	it('reads the stored document of an upload, or why it was refused', () => {
		expect(uploadOutcome({ results: [{ document: { id: 'd1' } }], rejected: [] })).toEqual({ documentId: 'd1' });
		expect(uploadOutcome({ results: [], rejected: [{ fileName: 'a.exe', code: 'DOCS_UNSUPPORTED_TYPE', message: 'This kind of file is not accepted.' }] })).toEqual({
			error: 'This kind of file is not accepted.'
		});
		expect(uploadOutcome({ results: [], rejected: [{ fileName: 'a', code: 'DOCS_FILE_TOO_LARGE', message: '' }] })).toEqual({ error: 'DOCS_FILE_TOO_LARGE' });
		expect(uploadOutcome(null)).toEqual({ error: 'The file was refused.' });
	});

	it('takes the files of a drop or a paste, none of a text', () => {
		const picked = new File(['x'], 'a.txt', { type: 'text/plain' });
		expect(filesOfTransfer({ files: [picked] as unknown as FileList })).toEqual([picked]);
		expect(filesOfTransfer({ files: [] as unknown as FileList })).toEqual([]);
		expect(filesOfTransfer(null)).toEqual([]);
	});

	it('shows a message’s known pictures and files apart, and counts the ones not read yet', () => {
		const known = new Map<string, IChatFile>([
			['p1', file('p1', 'image/png', { thumbUrl: 'https://files.example/p1-thumb' })],
			['f1', file('f1', 'application/pdf')],
			// A picture without any URL shows as a file.
			['p2', file('p2', 'image/png', {})]
		]);
		const shown = messageAttachments(['p1', 'f1', 'p2', 'missing'], known);
		expect(shown.images.map((item) => item.documentId)).toEqual(['p1']);
		expect(shown.files.map((item) => item.documentId)).toEqual(['f1', 'p2']);
		expect(shown.unknown).toBe(1);
		expect(messageAttachments(null, known)).toEqual({ images: [], files: [], unknown: 0 });
	});
});

describe('imageBox', () => {
	it('fits a picture of known size into the thumbnail box, never enlarging it', () => {
		expect(imageBox({ width: 1600, height: 900 })).toEqual({ width: 550, height: 309 });
		expect(imageBox({ width: 600, height: 1200 })).toEqual({ width: 175, height: 350 });
		expect(imageBox({ width: 100, height: 50 })).toEqual({ width: 100, height: 50 });
		expect(imageBox({ width: 3000, height: 2 })).toEqual({ width: 550, height: 1 });
	});

	it('reserves nothing when the size is not known', () => {
		expect(imageBox({})).toBeNull();
		expect(imageBox({ width: null, height: 200 })).toBeNull();
		expect(imageBox({ width: 0, height: 200 })).toBeNull();
		expect(imageBox({ width: Number.NaN, height: 200 })).toBeNull();
	});
});
