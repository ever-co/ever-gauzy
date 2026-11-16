import { excludeGithubPullRequests, isGithubPullRequest } from './github-issue-filter';

describe('isGithubPullRequest', () => {
	it('recognises an item carrying a pull_request object', () => {
		expect(isGithubPullRequest({ pull_request: { url: 'https://example.com/pulls/1' } })).toBe(true);
	});

	it('keeps a plain issue an issue', () => {
		expect(isGithubPullRequest({})).toBe(false);
		expect(isGithubPullRequest({ pull_request: undefined })).toBe(false);
		expect(isGithubPullRequest({ pull_request: null })).toBe(false);
	});

	it('does not throw on a missing item', () => {
		expect(isGithubPullRequest(null)).toBe(false);
		expect(isGithubPullRequest(undefined)).toBe(false);
	});
});

describe('excludeGithubPullRequests', () => {
	it('drops pull requests and keeps issues in their order', () => {
		const list = [
			{ id: 1, number: 1 },
			{ id: 2, number: 2, pull_request: { url: 'x' } },
			{ id: 3, number: 3 }
		];

		expect(excludeGithubPullRequests(list).map(({ id }) => id)).toEqual([1, 3]);
	});

	it('returns every item of a list without pull requests', () => {
		const list = [{ id: 1 }, { id: 2 }];

		expect(excludeGithubPullRequests(list)).toEqual(list);
	});

	it('returns an empty list for a value that is not a list', () => {
		expect(excludeGithubPullRequests(undefined)).toEqual([]);
		expect(excludeGithubPullRequests(null)).toEqual([]);
	});
});
