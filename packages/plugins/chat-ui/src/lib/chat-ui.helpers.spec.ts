import { ChatConversationKindEnum, ChatMessageKindEnum, ChatVisibilityEnum, IChatConversationWithState, IChatMessage } from '@gauzy/contracts';
import {
	apiErrorMessage,
	badgeText,
	cardPlace,
	ChatMemberIds,
	ChatPerson,
	continuesGroup,
	conversationPerson,
	conversationTitle,
	groupShortTitle,
	hasMessages,
	initialsOf,
	isSameDay,
	isUnread,
	markMentions,
	matchParts,
	memberEmployeeIds,
	membershipOf,
	mentionedEmployeeIds,
	mentionsMe,
	mentionQueryAt,
	mergeMessages,
	nameHue,
	namesToTokens,
	newNonce,
	otherMemberCount,
	ownPicture,
	personTriggerOf,
	plainBody,
	rankMentions,
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

describe('hasMessages', () => {
	it('is false for a conversation nobody has written in', () => {
		expect(hasMessages({ messageCount: 0, lastMessageAt: null, state: null })).toBe(false);
	});

	it('is true once it holds a message, or once my read marker moved (my own first message)', () => {
		expect(hasMessages({ messageCount: 1, lastMessageAt: null, state: null })).toBe(true);
		expect(hasMessages({ messageCount: 0, lastMessageAt: new Date('2026-11-07T10:00:00Z'), state: null })).toBe(true);
		expect(
			hasMessages({
				messageCount: 0,
				lastMessageAt: null,
				state: { lastReadMessageId: 'm1' } as IChatConversationWithState['state']
			})
		).toBe(true);
	});
});

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
		expect(html).toContain(`<span class="chat-mention chat-mention-person chat-person-${ANNA}">@Anna Ivanova</span>`);
		expect(html).not.toContain('<script');
	});

	it('finds the person an element of the page stands for', () => {
		const host = document.createElement('div');
		host.innerHTML = `<span data-person-id="${ANNA}"><b>Anna</b></span><span class="chat-mention chat-mention-person chat-person-${BOB}">@Bob</span><i>none</i>`;
		const [marked, chip, none] = [host.querySelector('b'), host.querySelector('.chat-mention'), host.querySelector('i')];
		expect(personTriggerOf(marked)).toEqual({ element: host.firstElementChild, employeeId: ANNA });
		expect(personTriggerOf(chip)?.employeeId).toBe(BOB);
		expect(personTriggerOf(none)).toBeNull();
		expect(personTriggerOf(null)).toBeNull();
		// Only an id of the shape the page writes counts as a person.
		host.innerHTML = '<span data-person-id="a b&quot;c">x</span>';
		expect(personTriggerOf(host.firstElementChild)).toBeNull();
		expect(nameHue('Anna Ivanova')).toBe(nameHue('Anna Ivanova'));
		expect(nameHue('Anna Ivanova')).toBeGreaterThanOrEqual(0);
		expect(nameHue('Anna Ivanova')).toBeLessThan(360);
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

	it('keeps a mention a mention inside the formatting bar’s marks', () => {
		const bob = new Map([['Bob Stone', BOB]]);
		const general = new Map([['general', GENERAL]]);
		// Italic, bold and strike around a person (the selection taken without its trailing space).
		expect(namesToTokens('_@Bob Stone_ ', bob)).toBe(`_<@${BOB}>_ `);
		expect(namesToTokens('**@Bob Stone**', bob)).toBe(`**<@${BOB}>**`);
		expect(namesToTokens('~~@Bob Stone~~', bob)).toBe(`~~<@${BOB}>~~`);
		expect(namesToTokens('_#general_', new Map(), general)).toBe(`_<#${GENERAL}>_`);
		// ... and around @channel / @here.
		expect(namesToTokens('**@channel**', new Map())).toBe('**<!channel>**');
		expect(namesToTokens('_@here_ please', new Map())).toBe('_<!here>_ please');
		expect(namesToTokens('~~@channel~~', new Map())).toBe('~~<!channel>~~');
		// An underscore that goes on into a word is part of it: no mention there.
		expect(namesToTokens('@Bob Stone_x', bob)).toBe('@Bob Stone_x');
		expect(namesToTokens('mail@here @channels', new Map())).toBe('mail@here @channels');
		// The box tints exactly what goes out as a mention.
		expect(markMentions('**@Bob Stone** _@channel_', ['@Bob Stone'])).toEqual([
			{ text: '**', mention: false },
			{ text: '@Bob Stone', mention: true },
			{ text: '** _', mention: false },
			{ text: '@channel', mention: true },
			{ text: '_', mention: false }
		]);
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

	it('cuts a name around the part a query matches', () => {
		expect(matchParts('Aster Abebe', 'st')).toEqual({ before: 'A', match: 'st', after: 'er Abebe' });
		expect(matchParts('Aster Abebe', 'AB')).toEqual({ before: 'Aster ', match: 'Ab', after: 'ebe' });
		expect(matchParts('Aster Abebe', '')).toEqual({ before: 'Aster Abebe', match: '', after: '' });
		expect(matchParts('Aster Abebe', 'zz')).toEqual({ before: 'Aster Abebe', match: '', after: '' });
		// A word start beats an earlier match inside a word.
		expect(matchParts('Tessa Stone', 'st')).toEqual({ before: 'Tessa ', match: 'St', after: 'one' });
	});

	it('ranks the @ suggestions: name start, word start, inside; members first, me after them', () => {
		const list: ChatPerson[] = [
			{ employeeId: 'a', userId: null, name: 'Aster A.', imageUrl: null },
			{ employeeId: 'b', userId: null, name: 'Booster P.', imageUrl: null },
			{ employeeId: 'c', userId: null, name: 'Carter N.', imageUrl: null },
			{ employeeId: 'm', userId: null, name: 'Andy Me', imageUrl: null },
			{ employeeId: 's', userId: null, name: 'Sam Steel', imageUrl: null }
		];
		const all = { ids: new Set(['c', 'm']), complete: true };
		const names = (query: string, memberIds: ChatMemberIds | null = null) =>
			rankMentions(list, query, { memberIds, meEmployeeId: 'm' }).map((item) => item.person.name);
		expect(names('st')).toEqual(['Sam Steel', 'Aster A.', 'Booster P.']);
		expect(names('')).toEqual(['Aster A.', 'Booster P.', 'Carter N.', 'Sam Steel', 'Andy Me']);
		expect(names('', all)).toEqual(['Carter N.', 'Andy Me', 'Aster A.', 'Booster P.', 'Sam Steel']);
		const [carter, , aster] = rankMentions(list, '', { memberIds: all, meEmployeeId: 'm' });
		expect(carter.member).toBe(true);
		expect(aster.member).toBe(false);
		expect(rankMentions(list, 'and', { meEmployeeId: 'm' })[0]).toMatchObject({ isMe: true, member: null, parts: { match: 'And' } });
	});

	it('does not call anyone an outsider when the member list is only a summary', () => {
		const list: ChatPerson[] = [
			{ employeeId: 'a', userId: null, name: 'Aster A.', imageUrl: null },
			{ employeeId: 'c', userId: null, name: 'Carter N.', imageUrl: null },
			{ employeeId: 'z', userId: null, name: 'Zed Z.', imageUrl: null }
		];
		// Known members first, then the ones the summary cannot tell about (never "not in this conversation").
		const ranked = rankMentions(list, '', { memberIds: { ids: new Set(['z']), complete: false } });
		expect(ranked.map((item) => [item.person.name, item.member])).toEqual([
			['Zed Z.', true],
			['Aster A.', null],
			['Carter N.', null]
		]);
	});

	it('marks the mentions of the box where they sit', () => {
		expect(markMentions('hi @Anna Ivanova, see #general and @channel', ['@Anna Ivanova', '#general'])).toEqual([
			{ text: 'hi ', mention: false },
			{ text: '@Anna Ivanova', mention: true },
			{ text: ', see ', mention: false },
			{ text: '#general', mention: true },
			{ text: ' and ', mention: false },
			{ text: '@channel', mention: true }
		]);
		// Not inside a word, not followed by a letter.
		expect(markMentions('mail@here @channels', [])).toEqual([{ text: 'mail@here @channels', mention: false }]);
		expect(markMentions('', ['@Anna'])).toEqual([]);
	});
});

describe('people', () => {
	it('keeps a person’s own picture and drops the generic silhouette', () => {
		expect(ownPicture('https://cdn.example.com/a.png')).toBe('https://cdn.example.com/a.png');
		expect(ownPicture('assets/images/avatars/avatar-default.svg')).toBeNull();
		expect(ownPicture('/assets/images/avatars/avatar-default.svg?v=2')).toBeNull();
		expect(ownPicture('  ')).toBeNull();
		expect(ownPicture(null)).toBeNull();
	});

	it('lists the employees of a conversation and knows whether that is all of them', () => {
		const anna = [{ employeeId: ANNA, userId: 'u1' } as never];
		expect(memberEmployeeIds({ members: anna, memberCount: 1 })).toEqual({ ids: new Set([ANNA]), complete: true });
		// A summary: fewer members listed than the conversation holds.
		expect(memberEmployeeIds({ members: anna, memberCount: 12 })).toEqual({ ids: new Set([ANNA]), complete: false });
		expect(memberEmployeeIds({ members: anna } as never)).toEqual({ ids: new Set([ANNA]), complete: true });
		expect(memberEmployeeIds({} as never)).toBeNull();
		expect(memberEmployeeIds(null)).toBeNull();
	});

	it('tells whether someone is in a conversation only when the member list can tell', () => {
		expect(membershipOf({ ids: new Set([ANNA]), complete: true }, ANNA)).toBe(true);
		expect(membershipOf({ ids: new Set([ANNA]), complete: true }, BOB)).toBe(false);
		expect(membershipOf({ ids: new Set([ANNA]), complete: false }, ANNA)).toBe(true);
		expect(membershipOf({ ids: new Set([ANNA]), complete: false }, BOB)).toBeNull();
		expect(membershipOf(null, ANNA)).toBeNull();
	});
});

describe('the profile card’s place', () => {
	const viewport = { width: 1280, height: 800 };
	const height = 300;

	it('goes right of the person, level with them', () => {
		expect(cardPlace({ top: 100, left: 200, right: 240 }, height, viewport)).toEqual({ top: 100, left: 248 });
	});

	it('goes left of the person when the right side has no room', () => {
		// 1100 + 8 + 296 would pass 1280 - 8: left of them instead (1060 - 296 - 8).
		expect(cardPlace({ top: 100, left: 1060, right: 1100 }, height, viewport)).toEqual({ top: 100, left: 756 });
	});

	it('stays inside a window too narrow for either side', () => {
		const narrow = { width: 360, height: 800 };
		// Neither side fits: held at the person's left, pulled in so its right edge stays 8px inside the window.
		expect(cardPlace({ top: 100, left: 120, right: 160 }, height, narrow)).toEqual({ top: 100, left: 56 });
		// Never past the window's left margin.
		expect(cardPlace({ top: 100, left: 0, right: 20 }, height, { width: 200, height: 800 })).toEqual({ top: 100, left: 8 });
	});

	it('moves up rather than run off the bottom, and never above the top', () => {
		expect(cardPlace({ top: 700, left: 200, right: 240 }, height, viewport)).toEqual({ top: 492, left: 248 });
		expect(cardPlace({ top: -50, left: 200, right: 240 }, height, viewport)).toEqual({ top: 8, left: 248 });
		// A card taller than the window starts at the top margin.
		expect(cardPlace({ top: 100, left: 200, right: 240 }, 900, viewport)).toEqual({ top: 8, left: 248 });
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

	it('names a group by first names and counts its people besides me', () => {
		const group = conversation({
			kind: ChatConversationKindEnum.GROUP,
			name: null,
			members: [ANNA, BOB, 'unknown'].map((employeeId) => ({ employeeId, userId: 'u', role: 'member' as never }))
		});
		expect(groupShortTitle(group, people, ANNA)).toBe('Bob');
		expect(groupShortTitle(group, people, null)).toBe('Anna, Bob');
		expect(groupShortTitle(conversation({ members: [] }), people, ANNA)).toBeNull();
		expect(otherMemberCount(group, ANNA)).toBe(2);
		expect(otherMemberCount(conversation({ members: undefined }), ANNA)).toBe(0);
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

describe('display', () => {
	const pair = [
		{ employeeId: ANNA, userId: 'u1', role: 'member' as never },
		{ employeeId: BOB, userId: 'u2', role: 'member' as never }
	];

	it('shows the other person of a direct conversation, myself when alone, nobody for a channel', () => {
		expect(conversationPerson(conversation({ kind: ChatConversationKindEnum.DIRECT, members: pair }), people, ANNA)?.name).toBe('Bob Stone');
		expect(conversationPerson(conversation({ kind: ChatConversationKindEnum.DIRECT, members: [pair[0]] }), people, ANNA)?.name).toBe('Anna Ivanova');
		expect(conversationPerson(conversation({ members: pair }), people, ANNA)).toBeNull();
		expect(conversationPerson(conversation({ kind: ChatConversationKindEnum.GROUP, members: [] }), people, ANNA)).toBeNull();
	});

	it('knows a body that mentions me or everyone', () => {
		expect(mentionsMe(`hi <@${ANNA}>`, ANNA)).toBe(true);
		expect(mentionsMe(`hi <@${BOB}>`, ANNA)).toBe(false);
		expect(mentionsMe('heads up <!here>', ANNA)).toBe(true);
		expect(mentionsMe('heads up <!channel>', null)).toBe(true);
		expect(mentionsMe(`hi <@${ANNA}>`, null)).toBe(false);
	});

	it('compares calendar days', () => {
		expect(isSameDay(new Date(2026, 10, 7, 0, 1), new Date(2026, 10, 7, 23, 59))).toBe(true);
		expect(isSameDay(new Date(2026, 10, 7, 23, 59), new Date(2026, 10, 8, 0, 1))).toBe(false);
		expect(isSameDay(new Date(2025, 10, 7), new Date(2026, 10, 7))).toBe(false);
	});
});
