import { SyncTags } from '@gauzy/constants';
import {
	GITHUB_LABEL_NAME_MAX_LENGTH,
	hasGithubSyncLabel,
	isValidGithubLabelName,
	normalizeGithubLabelName,
	resolveGithubSyncLabel
} from './github-sync-label';

/**
 * The GitHub sync matched issues on `project.syncTag`, but the GitHub integration page overwrote that label with the
 * default one on every repository sync, so a project could not keep a label of its own (#7083).
 */
describe('resolveGithubSyncLabel', () => {
	it('keeps the label the project chose', () => {
		expect(resolveGithubSyncLabel('needs-gauzy')).toBe('needs-gauzy');
	});

	it('trims the chosen label', () => {
		expect(resolveGithubSyncLabel('  needs gauzy \t')).toBe('needs gauzy');
	});

	it.each([undefined, null, '', '   '])(
		'falls back to the default label when the project has none (%p)',
		(syncTag) => {
			expect(resolveGithubSyncLabel(syncTag)).toBe(SyncTags.GAUZY);
		}
	);

	it('uses the same default label the GitHub page always stored', () => {
		expect(resolveGithubSyncLabel()).toBe('Gauzy');
	});
});

describe('normalizeGithubLabelName', () => {
	it('trims surrounding whitespace only', () => {
		expect(normalizeGithubLabelName('  good first issue  ')).toBe('good first issue');
	});

	it.each([undefined, null, 42, {}, '  '])('returns an empty name for %p', (value) => {
		expect(normalizeGithubLabelName(value)).toBe('');
	});
});

describe('isValidGithubLabelName', () => {
	it('accepts a label GitHub accepts', () => {
		expect(isValidGithubLabelName('Gauzy')).toBe(true);
		expect(isValidGithubLabelName('type: bug 🐛')).toBe(true);
	});

	it('accepts a label of exactly the maximum length, surrounding whitespace aside', () => {
		expect(isValidGithubLabelName(` ${'a'.repeat(GITHUB_LABEL_NAME_MAX_LENGTH)} `)).toBe(true);
	});

	it('counts an emoji as one character, as GitHub does', () => {
		expect(isValidGithubLabelName('🐛'.repeat(GITHUB_LABEL_NAME_MAX_LENGTH))).toBe(true);
	});

	it('refuses a label longer than GitHub allows', () => {
		expect(isValidGithubLabelName('a'.repeat(GITHUB_LABEL_NAME_MAX_LENGTH + 1))).toBe(false);
	});

	it.each([undefined, null, '', '   '])('refuses an empty label (%p)', (value) => {
		expect(isValidGithubLabelName(value)).toBe(false);
	});

	it.each(['two\nlines', 'tab\tinside', 'bell\u0007'])('refuses a label with a control character (%p)', (value) => {
		expect(isValidGithubLabelName(value)).toBe(false);
	});
});

describe('hasGithubSyncLabel', () => {
	const labels = [{ name: 'bug' }, { name: ' needs-gauzy ' }];

	it('finds the sync label among the issue labels, trimmed', () => {
		expect(hasGithubSyncLabel(labels, 'needs-gauzy')).toBe(true);
		expect(hasGithubSyncLabel(labels, ' needs-gauzy')).toBe(true);
	});

	it('compares names exactly otherwise, as the sync always did', () => {
		expect(hasGithubSyncLabel(labels, 'Needs-Gauzy')).toBe(false);
		expect(hasGithubSyncLabel(labels, 'needs')).toBe(false);
	});

	it('is false for an issue without labels', () => {
		expect(hasGithubSyncLabel([], 'bug')).toBe(false);
		expect(hasGithubSyncLabel(undefined, 'bug')).toBe(false);
		expect(hasGithubSyncLabel(null, 'bug')).toBe(false);
	});

	it('never matches an empty sync label', () => {
		expect(hasGithubSyncLabel([{ name: '' }, { name: null }, {}], '  ')).toBe(false);
	});
});
