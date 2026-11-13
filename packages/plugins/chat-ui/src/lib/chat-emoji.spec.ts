import { CHAT_EMOJI, emojiByName, emojiQueryAt, replaceShortcodeBefore, suggestEmoji } from './chat-emoji';

describe('chat emoji', () => {
	it('has one entry per name, aliases included', () => {
		const names = CHAT_EMOJI.flatMap((emoji) => [emoji.code, ...(emoji.aliases ?? [])]);
		expect(new Set(names).size).toBe(names.length);
		expect(names.every((name) => /^[a-z0-9_+-]+$/.test(name))).toBe(true);
	});

	it('finds an emoji by its name or an alias, whatever the case', () => {
		expect(emojiByName('thumbs_up')?.emoji).toBe('👍');
		expect(emojiByName('+1')?.emoji).toBe('👍');
		expect(emojiByName('Party')?.emoji).toBe('🎉');
		expect(emojiByName('nothing_like_this')).toBeUndefined();
	});

	describe('emojiQueryAt', () => {
		it('opens after a colon at the start or after a space, with two name characters', () => {
			expect(emojiQueryAt(':sm', 3)).toEqual({ query: 'sm', start: 0 });
			expect(emojiQueryAt('nice :thu', 9)).toEqual({ query: 'thu', start: 5 });
			expect(emojiQueryAt('(:Fi', 4)).toEqual({ query: 'fi', start: 1 });
		});

		it('stays closed for one character, a time, a URL, or a caret elsewhere', () => {
			expect(emojiQueryAt(':s', 2)).toBeNull();
			expect(emojiQueryAt('at 10:30', 8)).toBeNull();
			expect(emojiQueryAt('see https://example.com', 23)).toBeNull();
			expect(emojiQueryAt(':smile done', 11)).toBeNull();
			expect(emojiQueryAt(':smile done', 6)).toEqual({ query: 'smile', start: 0 });
		});
	});

	describe('suggestEmoji', () => {
		it('lists the names that start with the query first, the shortest first', () => {
			const found = suggestEmoji('hea', 4).map((emoji) => emoji.code);
			expect(found[0]).toBe('heart');
			expect(found).toContain('heart_eyes');
		});

		it('also finds a name or an alias that only holds the query, each emoji once', () => {
			const codes = suggestEmoji('heart', 20).map((emoji) => emoji.code);
			expect(codes).toContain('green_heart');
			expect(new Set(codes).size).toBe(codes.length);
			expect(suggestEmoji('congrats').map((emoji) => emoji.emoji)).toEqual(['🎉']);
		});

		it('needs two characters and keeps to the limit', () => {
			expect(suggestEmoji('h')).toEqual([]);
			expect(suggestEmoji('ar', 3)).toHaveLength(3);
		});
	});

	describe('replaceShortcodeBefore', () => {
		it('replaces a complete known name before the caret and puts the caret after the emoji', () => {
			expect(replaceShortcodeBefore('ship it :rocket:', 16)).toEqual({ text: 'ship it 🚀', caret: 8 + '🚀'.length });
			expect(replaceShortcodeBefore(':+1: and more', 4)).toEqual({ text: '👍 and more', caret: '👍'.length });
		});

		it('leaves an unknown name, a time and a name not right before the caret as typed', () => {
			expect(replaceShortcodeBefore('a :nothing_like_this:', 21)).toBeNull();
			expect(replaceShortcodeBefore('at 10:30:', 9)).toBeNull();
			expect(replaceShortcodeBefore(':rocket: x', 10)).toBeNull();
		});
	});
});
