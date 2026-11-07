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

	it("cuts a long name to the column's length, by code point", () => {
		expect(assistedByOf('x'.repeat(500))).toHaveLength(CHAT_ASSISTED_BY_MAX_LENGTH);
		const atTheLimit = 'a'.repeat(CHAT_ASSISTED_BY_MAX_LENGTH - 1) + '🤖';
		expect(assistedByOf(atTheLimit)).toBe(atTheLimit);
		const past = assistedByOf('a'.repeat(CHAT_ASSISTED_BY_MAX_LENGTH) + '🤖') as string;
		expect(Array.from(past)).toHaveLength(CHAT_ASSISTED_BY_MAX_LENGTH);
		expect(past.endsWith('a')).toBe(true);
	});
});
