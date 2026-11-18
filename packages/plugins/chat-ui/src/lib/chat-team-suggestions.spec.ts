import { ChatTeam, teamChannelOf, teamSuggestions } from './chat-team-suggestions';

const teams: ChatTeam[] = [
	{ id: 't1', name: 'Web Team' },
	{ id: 't2', name: 'Design' },
	{ id: 't3', name: 'Backend Web' },
	{ id: 't4', name: 'Sales' }
];
const names = (list: { name: string }[]) => list.map((item) => item.name);

describe('teamSuggestions', () => {
	it('offers every team, by name, while nothing is typed', () => {
		expect(names(teamSuggestions(teams, '', []))).toEqual(['Backend Web', 'Design', 'Sales', 'Web Team']);
	});

	it('narrows to the teams containing what is typed, those starting with it first, without case or a leading #', () => {
		expect(names(teamSuggestions(teams, '#WEB', []))).toEqual(['Web Team', 'Backend Web']);
	});

	it('marks the names a listed channel already has, and offers the free ones first', () => {
		const suggestions = teamSuggestions(teams, '', ['design', null, 'general']);
		expect(names(suggestions)).toEqual(['Backend Web', 'Sales', 'Web Team', 'Design']);
		expect(suggestions.find((item) => item.name === 'Design')?.taken).toBe(true);
		expect(suggestions.find((item) => item.name === 'Sales')?.taken).toBe(false);
	});

	it('offers each name once, skips nameless teams, and stops at the limit', () => {
		const many: ChatTeam[] = [...teams, { id: 't5', name: ' web team ' }, { id: 't6', name: '   ' }];
		expect(names(teamSuggestions(many, 'web', []))).toEqual(['Web Team', 'Backend Web']);
		expect(teamSuggestions(teams, '', [], 2)).toHaveLength(2);
	});
});

describe('teamChannelOf', () => {
	const conversations = [
		{ id: 'c1', kind: 'direct', name: 'Web Team' },
		{ id: 'c2', kind: 'channel', name: 'general' },
		{ id: 'c3', kind: 'channel', name: '#web team', archivedAt: '2026-01-01' },
		{ id: 'c4', kind: 'channel', name: ' Web Team ' }
	];

	it("finds the channel named as the team, without case or a leading #, an open one before an archived one", () => {
		expect(teamChannelOf(conversations, 'web TEAM')?.id).toBe('c4');
	});

	it('falls back to an archived channel of that name', () => {
		expect(teamChannelOf(conversations.slice(0, 3), 'Web Team')?.id).toBe('c3');
	});

	it('takes channels only, and nothing for a team without a name or without its channel', () => {
		expect(teamChannelOf(conversations.slice(0, 2), 'Web Team')).toBeNull();
		expect(teamChannelOf(conversations, '  ')).toBeNull();
		expect(teamChannelOf(conversations, 'Design')).toBeNull();
	});

	it('takes the oldest open channel of that name, then the lowest id: two made at once settle on the same', () => {
		const twins = [
			{ id: 'c9', kind: 'channel', name: 'Web Team', createdAt: '2026-11-18T10:00:01Z' },
			{ id: 'c8', kind: 'channel', name: 'Web Team', createdAt: '2026-11-18T10:00:00Z' },
			{ id: 'c7', kind: 'channel', name: 'Web Team', createdAt: '2026-11-18T10:00:00Z' },
			{ id: 'c1', kind: 'channel', name: 'Web Team', createdAt: '2026-01-01T00:00:00Z', archivedAt: '2026-02-01' }
		];
		expect(teamChannelOf(twins, 'Web Team')?.id).toBe('c7');
		expect(teamChannelOf([...twins].reverse(), 'Web Team')?.id).toBe('c7');
	});

	it("keeps to the given organization: another organization's channel of that name is not the team's", () => {
		const across = [
			{ id: 'c-other', kind: 'channel', name: 'Web Team', organizationId: 'org-2', createdAt: '2026-01-01T00:00:00Z' },
			{ id: 'c-ours', kind: 'channel', name: 'Web Team', organizationId: 'org-1', createdAt: '2026-06-01T00:00:00Z' }
		];
		expect(teamChannelOf(across, 'Web Team', 'org-1')?.id).toBe('c-ours');
		expect(teamChannelOf(across.slice(0, 1), 'Web Team', 'org-1')).toBeNull();
		expect(teamChannelOf(across, 'Web Team')?.id).toBe('c-other');
	});
});
