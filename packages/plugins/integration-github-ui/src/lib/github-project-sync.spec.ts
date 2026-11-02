import {
	GithubProjectSyncModeEnum,
	collectGithubLabelNames,
	filterGithubLabelNames,
	getGithubProjectSyncMode
} from './github-project-sync';

describe('getGithubProjectSyncMode', () => {
	it('is off when the project does not auto-sync', () => {
		expect(getGithubProjectSyncMode({ isTasksAutoSync: false, isTasksAutoSyncOnLabel: true })).toBe(
			GithubProjectSyncModeEnum.OFF
		);
		expect(getGithubProjectSyncMode({ isTasksAutoSync: null, isTasksAutoSyncOnLabel: true })).toBe(
			GithubProjectSyncModeEnum.OFF
		);
		expect(getGithubProjectSyncMode(undefined)).toBe(GithubProjectSyncModeEnum.OFF);
	});

	it('syncs only labelled issues when the project filters on its label', () => {
		expect(getGithubProjectSyncMode({ isTasksAutoSync: true, isTasksAutoSyncOnLabel: true })).toBe(
			GithubProjectSyncModeEnum.LABELLED
		);
	});

	it('syncs every issue otherwise', () => {
		expect(getGithubProjectSyncMode({ isTasksAutoSync: true, isTasksAutoSyncOnLabel: false })).toBe(
			GithubProjectSyncModeEnum.ALL_ISSUES
		);
	});
});

describe('collectGithubLabelNames', () => {
	const issues = [
		{ labels: [{ name: 'bug' }, { name: 'Gauzy' }] },
		{ labels: [{ name: ' enhancement ' }, { name: 'Bug' }] },
		{ labels: [] },
		{ labels: undefined }
	] as never[];

	it('lists the preferred names first, then the repository labels alphabetically, each once regardless of case', () => {
		expect(collectGithubLabelNames(issues, ['Gauzy', 'needs-gauzy'])).toEqual([
			'Gauzy',
			'needs-gauzy',
			'bug',
			'enhancement'
		]);
	});

	it('offers a preferred name in the repository’s spelling when it differs only by case (the sync matches exactly)', () => {
		const repository = [{ labels: [{ name: 'gauzy' }, { name: 'needs-gauzy' }, { name: 'bug' }] }] as never[];

		expect(collectGithubLabelNames(repository, ['Gauzy', 'Needs-Gauzy'])).toEqual(['gauzy', 'needs-gauzy', 'bug']);
	});

	it('skips empty preferred names (a project without a label of its own)', () => {
		expect(collectGithubLabelNames([], ['Gauzy', null, undefined, '  '])).toEqual(['Gauzy']);
	});

	it('copes with no issues at all', () => {
		expect(collectGithubLabelNames(undefined)).toEqual([]);
		expect(collectGithubLabelNames(null, ['Gauzy'])).toEqual(['Gauzy']);
	});
});

describe('filterGithubLabelNames', () => {
	const names = ['Gauzy', 'bug', 'good first issue'];

	it('keeps the names containing the typed text, regardless of case', () => {
		expect(filterGithubLabelNames(names, 'GA')).toEqual(['Gauzy']);
		expect(filterGithubLabelNames(names, ' first ')).toEqual(['good first issue']);
	});

	it('keeps every name while nothing is typed', () => {
		expect(filterGithubLabelNames(names, '')).toEqual(names);
		expect(filterGithubLabelNames(names, null)).toEqual(names);
	});

	it('keeps every name while the field holds one of them, so another label can still be picked', () => {
		expect(filterGithubLabelNames(names, 'bug')).toEqual(names);
		expect(filterGithubLabelNames(names, ' gauzy ')).toEqual(names);
	});

	it('finds nothing for a label the repository does not have (it can still be typed)', () => {
		expect(filterGithubLabelNames(names, 'needs-gauzy')).toEqual([]);
	});
});
