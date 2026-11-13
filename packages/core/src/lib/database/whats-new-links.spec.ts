import { WHATS_NEW_LINK_SETTINGS, whatsNewLinkUrl } from './whats-new-links';

/**
 * The learn-more links of the What's New entries seeded for the other Ever products: an address the deployment sets,
 * taken only as an absolute http(s) URL that fits the column.
 */
describe('whatsNewLinkUrl', () => {
	it('answers the address a link setting holds', () => {
		expect(whatsNewLinkUrl('everTeams', { WHATS_NEW_EVER_TEAMS_URL: 'https://teams.example.test' })).toBe(
			'https://teams.example.test'
		);
		expect(whatsNewLinkUrl('ever', { WHATS_NEW_EVER_URL: ' http://ever.example.test/path ' })).toBe(
			'http://ever.example.test/path'
		);
	});

	it('answers no link for no link, an unset or empty setting, or one that is not an absolute http(s) URL of 255 characters at most', () => {
		expect(whatsNewLinkUrl('', { WHATS_NEW_EVER_URL: 'https://ever.example.test' })).toBe('');
		expect(whatsNewLinkUrl('everTeamsDocs', {})).toBe('');
		for (const value of ['', '   ', '/relative', 'javascript:alert(1)', 'ftp://ever.example.test', 'https:ever.example.test', 'https:/ever.example.test', 'https://', 'not a url', `https://a.test/${'x'.repeat(250)}`]) {
			expect(whatsNewLinkUrl('ever', { WHATS_NEW_EVER_URL: value })).toBe('');
		}
	});

	it('reads one setting per link, none of them an Ever Platform base URL variable', () => {
		expect(Object.values(WHATS_NEW_LINK_SETTINGS)).toEqual([
			'WHATS_NEW_EVER_TEAMS_URL',
			'WHATS_NEW_EVER_TEAMS_DOCS_URL',
			'WHATS_NEW_EVER_URL'
		]);
	});
});
