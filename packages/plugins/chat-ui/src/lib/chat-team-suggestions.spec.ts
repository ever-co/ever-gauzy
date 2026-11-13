import { ChatTeam, teamSuggestions } from './chat-team-suggestions';

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
