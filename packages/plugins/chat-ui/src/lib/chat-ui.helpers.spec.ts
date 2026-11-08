import { ChatConversationKindEnum, ChatMessageKindEnum, ChatVisibilityEnum, IChatConversationWithState, IChatMessage } from '@gauzy/contracts';
import {
	apiErrorMessage,
	badgeText,
	ChatPerson,
	continuesGroup,
	conversationTitle,
	initialsOf,
	isUnread,
	mentionedEmployeeIds,
	mentionQueryAt,
	mergeMessages,
	namesToTokens,
	newNonce,
	plainBody,
	renderBodyHtml,
	sortConversations,
	splitMentions,
	suggestMentions,
	tokensToNames,
	uniqueLabel,
	userName
} from './chat-ui.helpers';

const ANNA = '11111111-1111-4111-8111-111111111111';
const BOB = '22222222-2222-4222-8222-222222222222';
const GENERAL = '33333333-3333-4333-8333-333333333333';

const people = new Map<string, ChatPerson>([
	[ANNA, { employeeId: ANNA, userId: 'u1', name: 'Anna Ivanova', imageUrl: null }],
	[BOB, { employeeId: BOB, userId: 'u2', name: 'Bob Stone', imageUrl: null }]
]);
const conversations = new Map<string, string>([[GENERAL, 'general']]);

function message(id: string, overrides: Partial<IChatMessage> = {}): IChatMessage {
	return {
		id,
		conversationId: GENERAL,
		kind: ChatMessageKindEnum.MESSAGE,
		body: id,
		mentionsChannel: false,
		mentionsHere: false,
		alsoInConversation: false,
		replyCount: 0,
		createdAt: new Date('2026-11-07T10:00:00Z'),
		...overrides
	} as IChatMessage;
}

function conversation(overrides: Partial<IChatConversationWithState>): IChatConversationWithState {
	return {
		id: 'c',
		kind: ChatConversationKindEnum.CHANNEL,
		visibility: ChatVisibilityEnum.PUBLIC,
		position: 0,
		isDefault: false,
		messageCount: 0,
		state: null,
		memberCount: 2,
		...overrides
	} as IChatConversationWithState;
}

describe('mention tokens', () => {
	it('splits a body into text and chips, resolving names at render time', () => {
		const parts = splitMentions(`hi <@${ANNA}> see <#${GENERAL}> <!here> <@unknown>`, people, conversations, ANNA);
		expect(parts).toEqual([
			{ kind: 'text', text: 'hi ' },
			{ kind: 'mention', employeeId: ANNA, label: 'Anna Ivanova', isMe: true },
			{ kind: 'text', text: ' see ' },
			{ kind: 'channel', conversationId: GENERAL, label: 'general' },
			{ kind: 'text', text: ' ' },
			{ kind: 'everyone', label: 'here' },
			{ kind: 'text', text: ' <@unknown>' }
		]);
	});

	it('reads a plain preview and the mentioned employees', () => {
		expect(plainBody(`  <@${BOB}>   check <#${GENERAL}>\n<!channel>`, people, conversations)).toBe('@Bob Stone check #general @channel');
		expect(mentionedEmployeeIds(`<@${ANNA}> <@${BOB}> <@${ANNA}> <#${GENERAL}>`)).toEqual([ANNA, BOB]);
	});

	it('renders Markdown with chips and strips scripts', () => {
		// Stands in for Angular's sanitizer with the DOM, not a regex: script elements are removed, the rest is kept.
		const sanitizer = {
			sanitize: (_context: unknown, html: string) => {
				const template = document.createElement('template');
				template.innerHTML = html;
				template.content.querySelectorAll('script').forEach((script) => script.remove());
				return template.innerHTML;
			}
		};
		const html = renderBodyHtml(`**bold** <@${ANNA}> <script>alert(1)</script>`, people, conversations, BOB, sanitizer);
		expect(html).toContain('<strong>bold</strong>');
		expect(html).toContain('<span class="chat-mention">@Anna Ivanova</span>');
		expect(html).not.toContain('<script');
	});

	it('leaves remote media out of a rendered body, after the sanitizer', () => {
		const sanitizer = { sanitize: (_context: unknown, html: string) => html };
		const html = renderBodyHtml(
			'see ![x](https://example.test/p.gif) <img src="https://example.test/q.gif"> <video poster="https://example.test/v.png"><source src="https://example.test/v.mp4"></video> <audio src="https://example.test/a.mp3"></audio> done',
			people,
			conversations,
			null,
			sanitizer
		);
		expect(html).not.toMatch(/<(img|picture|source|video|audio|track)\b/);
		expect(html).toContain('done');
	});

	it('makes a version-4 UUID nonce with or without randomUUID', () => {
		const pattern = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
		expect(newNonce()).toMatch(pattern);
		const original = globalThis.crypto;
		Object.defineProperty(globalThis, 'crypto', { value: { getRandomValues: (array: Uint8Array) => array.fill(7) }, configurable: true });
		try {
			expect(newNonce()).toMatch(pattern);
			Object.defineProperty(globalThis, 'crypto', { value: undefined, configurable: true });
			expect(newNonce()).toMatch(pattern);
		} finally {
			Object.defineProperty(globalThis, 'crypto', { value: original, configurable: true });
		}
	});

	it('shows tokens as labels while writing and turns the labels back into tokens, each person kept apart', () => {
		const BOB_TWIN = '44444444-4444-4444-8444-444444444444';
		const twins = new Map(people);
		twins.set(BOB_TWIN, { employeeId: BOB_TWIN, userId: 'u4', name: 'Bob Stone', imageUrl: null });
		const labels = tokensToNames(`<@${BOB}> and <@${BOB_TWIN}> in <#${GENERAL}> <!here>`, twins, conversations);
		expect(labels.text).toBe('@Bob Stone and @Bob Stone (2) in #general @here');
		expect(labels.people.get('Bob Stone')).toBe(BOB);
		expect(labels.people.get('Bob Stone (2)')).toBe(BOB_TWIN);
		expect(namesToTokens(labels.text, labels.people, labels.channels)).toBe(`<@${BOB}> and <@${BOB_TWIN}> in <#${GENERAL}> <!here>`);
		expect(uniqueLabel('Bob Stone', BOB, labels.people)).toBe('Bob Stone');
		expect(uniqueLabel('Bob Stone', 'someone-else', labels.people)).toBe('Bob Stone (3)');
		// A label is never matched inside a longer word.
		expect(namesToTokens('@Bob Stoned @Bob Stone', new Map([['Bob Stone', BOB]]))).toBe(`@Bob Stoned <@${BOB}>`);
	});

	it('reads the message of an API refusal', () => {
		expect(apiErrorMessage({ error: { message: 'No.' } })).toBe('No.');
		expect(apiErrorMessage({ error: { message: ['name is short', 'topic is long'] } })).toBe('name is short topic is long');
		expect(apiErrorMessage({ error: { message: '  ' } })).toBeNull();
		expect(apiErrorMessage(null)).toBeNull();
	});

	it('finds the @ query under the caret and suggests people', () => {
		expect(mentionQueryAt('hello @an', 9)).toEqual({ query: 'an', start: 6 });
		expect(mentionQueryAt('hello @an', 5)).toBeNull();
		expect(mentionQueryAt('mail@x', 6)).toBeNull();
		expect(suggestMentions([...people.values()], 'bo').map((person) => person.name)).toEqual(['Bob Stone']);
		expect(suggestMentions([...people.values()], '').map((person) => person.name)).toEqual(['Anna Ivanova', 'Bob Stone']);
	});
});

describe('conversations', () => {
	it('titles channels with # and direct conversations with the other people', () => {
		expect(conversationTitle(conversation({ name: 'general' }), people, ANNA, '?')).toBe('#general');
		expect(
			conversationTitle(
				conversation({ kind: ChatConversationKindEnum.DIRECT, members: [{ employeeId: ANNA, userId: 'u1', role: 'member' as never }, { employeeId: BOB, userId: 'u2', role: 'member' as never }] }),
				people,
				ANNA,
				'?'
			)
		).toBe('Bob Stone');
		expect(conversationTitle(conversation({ kind: ChatConversationKindEnum.GROUP, name: null, members: [] }), people, ANNA, 'Conversation')).toBe('Conversation');
	});

	it('sorts favourites first, then by the newest message, and knows unread ones', () => {
		const a = conversation({ id: 'a', name: 'a', lastMessageAt: new Date('2026-11-07T09:00:00Z') });
		const b = conversation({ id: 'b', name: 'b', lastMessageAt: new Date('2026-11-07T10:00:00Z') });
		const c = conversation({ id: 'c', name: 'c', state: { isFavorite: true, unreadCount: 0, mentionCount: 2 } as never });
		expect(sortConversations([a, b, c]).map((item) => item.id)).toEqual(['c', 'b', 'a']);
		expect(isUnread(c)).toBe(true);
		expect(isUnread(a)).toBe(false);
	});
});

describe('messages', () => {
	it('groups consecutive messages of one author within five minutes', () => {
		const first = message('1', { authorUserId: 'u1' });
		const second = message('2', { authorUserId: 'u1', createdAt: new Date('2026-11-07T10:04:00Z') });
		const later = message('3', { authorUserId: 'u1', createdAt: new Date('2026-11-07T10:06:00Z') });
		const other = message('4', { authorUserId: 'u2', createdAt: new Date('2026-11-07T10:04:00Z') });
		expect(continuesGroup(first, second)).toBe(true);
		expect(continuesGroup(first, later)).toBe(false);
		expect(continuesGroup(first, other)).toBe(false);
		expect(continuesGroup(undefined, second)).toBe(false);
	});

	it('merges pages by id in time order', () => {
		const merged = mergeMessages([message('b', { createdAt: new Date('2026-11-07T10:01:00Z') })], [message('a'), message('b', { body: 'edited', createdAt: new Date('2026-11-07T10:01:00Z') })]);
		expect(merged.map((item) => `${item.id}:${item.body}`)).toEqual(['a:a', 'b:edited']);
	});
});

describe('labels', () => {
	it('caps the badge and makes initials and names', () => {
		expect(badgeText(0)).toBe('');
		expect(badgeText(7)).toBe('7');
		expect(badgeText(120)).toBe('99+');
		expect(initialsOf('Anna Ivanova')).toBe('AI');
		expect(initialsOf('')).toBe('?');
		expect(userName({ firstName: 'Anna', lastName: 'Ivanova' })).toBe('Anna Ivanova');
		expect(userName({ name: 'anna', email: 'a@x' })).toBe('anna');
		expect(userName({ email: 'a@x' })).toBe('a@x');
	});
});
