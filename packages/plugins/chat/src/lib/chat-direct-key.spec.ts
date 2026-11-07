import { directKeyOf } from './chat-direct-key';

describe('directKeyOf', () => {
	it('is the same for the same people in any order or case, and 64 hex characters', () => {
		const key = directKeyOf(['B', 'a']);
		expect(key).toBe(directKeyOf(['A', 'b', 'a']));
		expect(key).toMatch(/^[0-9a-f]{64}$/);
		expect(key).not.toBe(directKeyOf(['a', 'c']));
	});
});
