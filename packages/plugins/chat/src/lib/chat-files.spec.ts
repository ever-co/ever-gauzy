import { chatFileOf, chatSqlDialectOf, imageSizeOf, jsonListHasColumn, linkMetadataOf } from './chat-files';

describe('the files query helpers', () => {
	it('names the dialect of a connection', () => {
		expect(chatSqlDialectOf('mysql')).toBe('mysql');
		expect(chatSqlDialectOf('mariadb')).toBe('mysql');
		expect(chatSqlDialectOf('better-sqlite3')).toBe('sqlite');
		expect(chatSqlDialectOf('postgres')).toBe('postgres');
		expect(chatSqlDialectOf(undefined)).toBe('postgres');
	});

	it('writes the predicate that keeps a link only when the message names its document, in the dialect', () => {
		expect(jsonListHasColumn('message.attachmentIds', 'link.documentId', 'mysql')).toBe(`message.attachmentIds LIKE CONCAT('%"', link.documentId, '"%')`);
		expect(jsonListHasColumn('message.attachmentIds', 'link.documentId', 'postgres')).toBe(`message.attachmentIds LIKE '%"' || CAST(link.documentId AS TEXT) || '"%'`);
		expect(jsonListHasColumn('message.attachmentIds', 'link.documentId', 'sqlite')).toBe(jsonListHasColumn('message.attachmentIds', 'link.documentId', 'postgres'));
	});

	it('stores the link metadata as text on SQLite and as an object elsewhere', () => {
		expect(linkMetadataOf('c1', 'sqlite')).toBe('{"conversationId":"c1"}');
		expect(linkMetadataOf('c1', 'postgres')).toEqual({ conversationId: 'c1' });
		expect(linkMetadataOf('c1', 'mysql')).toEqual({ conversationId: 'c1' });
	});
});

describe('chatFileOf', () => {
	const link = { documentId: 'd1', messageId: 'm1', conversationId: 'c1', attachedAt: '2026-11-07T10:00:00.000Z', authorEmployeeId: 'e1', authorUserId: 'u1' };

	it('joins the link and the document into one file of the pane', () => {
		expect(chatFileOf(link, { id: 'd1', name: 'Spec', originalFilename: 'spec.pdf', mimeType: 'application/pdf', fileSize: '1234', status: 'READY', fileUrl: 'https://f/spec.pdf', thumbUrl: null })).toEqual({
			documentId: 'd1',
			messageId: 'm1',
			conversationId: 'c1',
			name: 'Spec',
			originalFilename: 'spec.pdf',
			mimeType: 'application/pdf',
			fileSize: 1234,
			status: 'READY',
			fileUrl: 'https://f/spec.pdf',
			thumbUrl: null,
			width: null,
			height: null,
			authorEmployeeId: 'e1',
			authorUserId: 'u1',
			attachedAt: new Date('2026-11-07T10:00:00.000Z')
		});
	});

	it('names a file after its upload when it has no name, and answers nothing for a document that is gone', () => {
		expect(chatFileOf(link, { id: 'd1', name: '  ', originalFilename: 'notes.txt' })?.name).toBe('notes.txt');
		expect(chatFileOf(link, { id: 'd1' })?.name).toBe('file');
		expect(chatFileOf(link, { id: 'd1', fileSize: 'x' })?.fileSize).toBeNull();
		expect(chatFileOf(link, null)).toBeNull();
	});
});

describe('imageSizeOf', () => {
	it("answers a picture's size as the upload recorded it, from an object or SQLite's JSON text", () => {
		expect(imageSizeOf({ upload: { image: { width: 1920, height: 1080 } } })).toEqual({ width: 1920, height: 1080 });
		expect(imageSizeOf(JSON.stringify({ upload: { image: { width: 3, height: 4 } } }))).toEqual({ width: 3, height: 4 });
		const link = { documentId: 'd1', messageId: 'm1', conversationId: 'c1', attachedAt: new Date() };
		expect(chatFileOf(link, { id: 'd1', metadata: { upload: { image: { width: 640, height: 480 } } } })).toEqual(expect.objectContaining({ width: 640, height: 480 }));
	});

	it('answers nulls when no size, or no sensible one, was recorded', () => {
		expect(imageSizeOf(null)).toEqual({ width: null, height: null });
		expect(imageSizeOf({ upload: { declaredMimeType: 'application/pdf' } })).toEqual({ width: null, height: null });
		expect(imageSizeOf({ upload: { image: { width: 0, height: 10 } } })).toEqual({ width: null, height: null });
		expect(imageSizeOf({ upload: { image: { width: 1.5, height: 10 } } })).toEqual({ width: null, height: null });
		expect(imageSizeOf({ upload: { image: { width: '10', height: 10 } } })).toEqual({ width: null, height: null });
		expect(imageSizeOf({ upload: { image: { width: 10 } } })).toEqual({ width: null, height: null });
	});
});
