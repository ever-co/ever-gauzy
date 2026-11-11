import { CHAT_LINK_CARDS_MAX, linkCardsOf, withoutUnbalancedEnd } from './chat-links';

describe('linkCardsOf', () => {
	it('makes a card of each web link, in order, from the link alone', () => {
		expect(linkCardsOf('See https://www.example.com/docs/start?tab=1#intro and http://ever.co')).toEqual([
			{ url: 'https://www.example.com/docs/start?tab=1#intro', host: 'example.com', path: '/docs/start?tab=1#intro' },
			{ url: 'http://ever.co/', host: 'ever.co', path: '' }
		]);
	});

	it('leaves the punctuation that ends a sentence out, and reads a Markdown link', () => {
		expect(linkCardsOf('Read https://example.com/a. Then [the guide](https://example.com/guide)!').map((card) => card.url)).toEqual([
			'https://example.com/a',
			'https://example.com/guide'
		]);
	});

	it('keeps the balanced parentheses of a URL and leaves out the one closing the sentence', () => {
		expect(linkCardsOf('See https://en.wikipedia.org/wiki/Function_(mathematics).').map((card) => card.url)).toEqual([
			'https://en.wikipedia.org/wiki/Function_(mathematics)'
		]);
		expect(linkCardsOf('(more at https://example.com/a)').map((card) => card.url)).toEqual(['https://example.com/a']);
		expect(withoutUnbalancedEnd('https://example.com/x_(y))).')).toBe('https://example.com/x_(y)');
	});

	it('gives one card per link, a few at most', () => {
		expect(linkCardsOf('https://a.example https://a.example https://b.example')).toHaveLength(2);
		const many = Array.from({ length: 6 }, (_, index) => `https://site${index}.example`).join(' ');
		expect(linkCardsOf(many)).toHaveLength(CHAT_LINK_CARDS_MAX);
	});

	it('gives no card to a link in code, another scheme, or a task link of the app (the task card shows it)', () => {
		expect(linkCardsOf('`https://example.com/inline` and\n```\nhttps://example.com/block\n```')).toEqual([]);
		expect(linkCardsOf('ftp://example.com/file mailto:someone@example.com javascript:alert(1)')).toEqual([]);
		expect(linkCardsOf('https://app.example.com/#/pages/tasks/view/0d4f1c1e-0000-4000-8000-000000000001')).toEqual([]);
		expect(linkCardsOf('https://teams.example.com/task/0d4f1c1e-0000-4000-8000-000000000001?tab=1')).toEqual([]);
		expect(linkCardsOf('https://example.com/board?taskId=0d4f1c1e-0000-4000-8000-000000000001')).toEqual([]);
		// Not a task link: the id is not one.
		expect(linkCardsOf('https://example.com/tasks/overview')).toHaveLength(1);
	});

	it('shortens a long path', () => {
		const [card] = linkCardsOf(`https://example.com/${'a'.repeat(100)}`);
		expect(card.path.length).toBe(60);
		expect(card.path.endsWith('…')).toBe(true);
	});
});
