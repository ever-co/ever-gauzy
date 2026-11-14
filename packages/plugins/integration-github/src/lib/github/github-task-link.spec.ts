import {
	GITHUB_PULL_REQUEST_REFERENCES_MAX,
	githubItemUrlPatterns,
	parseGithubItemUrl,
	repositoryAddressOf,
	sameGithubItem,
	taskReferencesOfPullRequest
} from './github-task-link';

/** How a GitHub pull request or issue is told linked to a task: addresses and references (spec `task-automations`, T16). */
describe('GitHub task links', () => {
	describe('parseGithubItemUrl', () => {
		it('reads a pull request or issue address, whatever follows the number, owner and repository in lower case', () => {
			const item = { owner: 'acme', repo: 'site', number: 7 };
			expect(parseGithubItemUrl('https://github.com/acme/site/pull/7')).toEqual(item);
			expect(parseGithubItemUrl('https://github.com/Acme/Site/pull/7/files#diff-1')).toEqual(item);
			expect(parseGithubItemUrl(' http://www.github.com/acme/site/pull/7/ ')).toEqual(item);
			expect(parseGithubItemUrl('https://github.com/acme/site/issues/7?q=1#issuecomment-2')).toEqual(item);
		});

		it('reads nothing else', () => {
			for (const url of [
				null,
				'',
				'not a url',
				'ftp://github.com/acme/site/pull/7',
				'https://gitlab.com/acme/site/pull/7',
				'https://github.com.evil.example/acme/site/pull/7',
				'https://gist.github.com/acme/site/pull/7',
				'https://github.com/acme/site/commit/7',
				'https://github.com/acme/site/pull/0',
				'https://github.com/acme/site/pull/7a',
				'https://github.com/acme/site/pulls',
				'https://github.com/acme'
			]) {
				expect(parseGithubItemUrl(url)).toBeNull();
			}
		});

		it('names the same item for a pull request and an issue address of one number (one numbering per repository)', () => {
			expect(
				sameGithubItem(parseGithubItemUrl('https://github.com/acme/site/issues/7'), {
					owner: 'acme',
					repo: 'site',
					number: 7
				})
			).toBe(true);
			expect(
				sameGithubItem(parseGithubItemUrl('https://github.com/acme/site/pull/70'), {
					owner: 'acme',
					repo: 'site',
					number: 7
				})
			).toBe(false);
			expect(
				sameGithubItem(parseGithubItemUrl('https://github.com/acme/other/pull/7'), {
					owner: 'acme',
					repo: 'site',
					number: 7
				})
			).toBe(false);
			expect(sameGithubItem(null, { owner: 'acme', repo: 'site', number: 7 })).toBe(false);
		});

		it('finds the item’s addresses with its LIKE patterns, and no other number’s, names escaped', () => {
			const patterns = githubItemUrlPatterns({ owner: 'acme', repo: 'my_site', number: 7 });
			expect(patterns).toEqual([
				'%github.com/acme/my!_site/pull/7',
				'%github.com/acme/my!_site/pull/7/%',
				'%github.com/acme/my!_site/pull/7?%',
				'%github.com/acme/my!_site/pull/7#%',
				'%github.com/acme/my!_site/issues/7',
				'%github.com/acme/my!_site/issues/7/%',
				'%github.com/acme/my!_site/issues/7?%',
				'%github.com/acme/my!_site/issues/7#%'
			]);
		});
	});

	describe('repositoryAddressOf', () => {
		it('takes the full name, else the owner and name, in lower case', () => {
			expect(repositoryAddressOf({ full_name: 'Acme/Site' })).toEqual({ owner: 'acme', repo: 'site' });
			expect(repositoryAddressOf({ name: 'Site', owner: { login: 'Acme' } })).toEqual({
				owner: 'acme',
				repo: 'site'
			});
			expect(repositoryAddressOf({ full_name: '' })).toBeNull();
			expect(repositoryAddressOf(null)).toBeNull();
		});
	});

	describe('taskReferencesOfPullRequest', () => {
		it('reads upper-case references in the title and the branch name, each once, title first', () => {
			expect(
				taskReferencesOfPullRequest({
					title: '[WEB-42] Fix the footer (see WEB-42, API-7)',
					head: { ref: 'feature/WEB-42-footer' }
				})
			).toEqual(['WEB-42', 'API-7']);
			expect(taskReferencesOfPullRequest({ title: 'Footer', head: { ref: 'WEB-0042_footer' } })).toEqual([
				'WEB-42'
			]);
			expect(taskReferencesOfPullRequest({ title: 'Fix', head: { ref: 'fix/API-7' } })).toEqual(['API-7']);
		});

		it('reads no lower-case key, no part of a longer word or number, and no zero', () => {
			expect(
				taskReferencesOfPullRequest({
					title: 'Bump node-26 and web-42; WEBSITE-1x; aWEB-12; WEB-0; 3D-4',
					head: { ref: 'renovate/node-26.x' }
				})
			).toEqual([]);
			expect(taskReferencesOfPullRequest(null)).toEqual([]);
		});

		it('reads at most a bounded number of references', () => {
			const title = Array.from({ length: 30 }, (_, index) => `WEB-${index + 1}`).join(' ');
			expect(taskReferencesOfPullRequest({ title })).toHaveLength(GITHUB_PULL_REQUEST_REFERENCES_MAX);
		});
	});
});
