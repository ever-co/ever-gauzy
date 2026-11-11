/**
 * Messages of files only: the body may be empty when the message carries an attachment, and the files' names are
 * what such a message reads as.
 *
 * `@gauzy/core` is doubled at the module boundary (its barrel boots the whole application).
 */
jest.mock('@gauzy/core', () => {
	const decorator = () => () => undefined;
	const explicit: Record<string, unknown> = {
		__esModule: true,
		MultiORMColumn: decorator,
		MultiORMEntity: decorator,
		TenantOrganizationBaseEntity: class {},
		MikroOrmBaseEntityRepository: class {},
		RequestContext: { currentTenantId: () => null, currentUserId: () => null, hasPermission: () => false }
	};
	return new Proxy(explicit, { get: (target, name) => (name in target ? target[name as string] : function Anything() {}) });
});

import { BadRequestException } from '@nestjs/common';
import { CHAT_MESSAGE_MAX_LENGTH } from '@gauzy/contracts';
import { attachmentNamesOf, CHAT_ATTACHMENT_NAMES_MAX, ChatMessageService } from './chat-message.service';

const NEWLINE = String.fromCharCode(10);

describe('attachmentNamesOf', () => {
	it('names the files in the order attached, one per line, a nameless one as "file"', () => {
		const documents = [
			{ id: 'd2', name: 'chart.png' },
			{ id: 'd1', name: ' ', originalFilename: 'report.pdf' },
			{ id: 'd3', name: null, originalFilename: null }
		];
		expect(attachmentNamesOf(['d1', 'd2', 'd3'], documents)).toBe(['report.pdf', 'chart.png', 'file'].join(NEWLINE));
		expect(attachmentNamesOf([], documents)).toBeNull();
	});

	it('keeps each name on one line and the list within the column', () => {
		expect(attachmentNamesOf(['d1'], [{ id: 'd1', name: `two${NEWLINE}lines` }])).toBe('two lines');
		const long = Array.from({ length: 10 }, (_, index) => ({ id: `d${index}`, name: 'n'.repeat(300) }));
		const names = attachmentNamesOf(long.map((document) => document.id), long) as string;
		expect(names.length).toBe(CHAT_ATTACHMENT_NAMES_MAX);
		expect(names.split(NEWLINE)[0]).toHaveLength(255);
	});
});

describe('the body of a message', () => {
	const service = new ChatMessageService({} as never, {} as never, {} as never, {} as never, {} as never, {} as never, {} as never);
	const validBody = (body: string | undefined, hasAttachments?: boolean) =>
		(service as unknown as { validBody: (body: string | undefined, hasAttachments?: boolean) => string }).validBody(body, hasAttachments);

	it('may be empty, or left out, when the message carries a file', () => {
		expect(validBody('', true)).toBe('');
		expect(validBody(undefined, true)).toBe('');
		expect(validBody('  hi \r\n', true)).toBe('hi');
	});

	it('is still needed without a file, and still bounded', () => {
		expect(() => validBody('   ')).toThrow(BadRequestException);
		expect(() => validBody(undefined, false)).toThrow(BadRequestException);
		expect(() => validBody('x'.repeat(CHAT_MESSAGE_MAX_LENGTH + 1), true)).toThrow(BadRequestException);
	});
});
