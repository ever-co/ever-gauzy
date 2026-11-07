import { assistedByOf, CHAT_ASSISTED_BY_MAX_LENGTH } from './chat-assisted';

describe('assistedByOf', () => {
	it('keeps a named assistant, trimmed', () => {
		expect(assistedByOf('  Claude  ')).toBe('Claude');
	});

	it('marks nothing for an omitted or blank name', () => {
		expect(assistedByOf(undefined)).toBeNull();
		expect(assistedByOf(null)).toBeNull();
		expect(assistedByOf('   ')).toBeNull();
	});

	it("cuts a long name to the column's length", () => {
		expect(assistedByOf('x'.repeat(500))).toHaveLength(CHAT_ASSISTED_BY_MAX_LENGTH);
	});
});
