import { chatFileOf } from './chat-files';

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
