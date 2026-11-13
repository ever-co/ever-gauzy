// The plugin needs only these from the kernel; the real barrel boots the whole platform.
jest.mock('@gauzy/core', () => {
	const decorator = () => () => undefined;
	// Takes the repositories the plugin's services pass to `super`, through the default constructor.
	class CrudService {}
	class TenantOrganizationBaseEntity {}
	class MikroOrmBaseEntityRepository {}
	return {
		CrudService,
		TenantOrganizationBaseEntity,
		MikroOrmBaseEntityRepository,
		MultiORMEntity: decorator,
		MultiORMColumn: decorator,
		// The real one: the seed resolves the learn-more links through it.
		whatsNewLinkUrl: jest.requireActual('@gauzy/core/src/lib/database/whats-new-links').whatsNewLinkUrl
	};
});

import { ChangelogPlatformEnum, CHANGELOG_PLATFORM_PATTERN } from '@gauzy/contracts';
// Deep paths through the `@gauzy/core` package (not relative paths across projects), as other plugin specs import
// core internals; they are separate modules from the barrel mocked above.
import { SeedPlatformChangelogContent1791000005610 } from '@gauzy/core/src/lib/database/migrations/1791000005610-SeedPlatformChangelogContent';
import { RewordPlatformChangelogEntries1791000006900 } from '@gauzy/core/src/lib/database/migrations/1791000006900-RewordPlatformChangelogEntries';
import { platformChangelogEntryId } from '@gauzy/core/src/lib/database/platform-changelog-entry-id';
import { buildChangelogSeedRows, withoutExistingEntries } from './changelog.seed';
import { INITIAL_CHANGELOG_TEMPLATE } from './initial-changelog-template';
import { PLATFORM_CHANGELOG_TEMPLATES } from './platform-changelog-templates';

/** The changelog columns are plain `varchar`s, which MySQL sizes at 255. */
const MYSQL_VARCHAR = 255;

describe('platform changelog templates', () => {
	const templateRows = Object.entries(PLATFORM_CHANGELOG_TEMPLATES).flatMap(([platform, items]) =>
		items.map((item) => [
			platform,
			item.icon,
			item.title,
			item.date.toISOString(),
			item.content,
			item.learnMore
		])
	);

	it('carries starter entries for every Ever product but Gauzy', () => {
		expect(Object.keys(PLATFORM_CHANGELOG_TEMPLATES).sort()).toEqual(
			[ChangelogPlatformEnum.EVER_PLATFORM, ChangelogPlatformEnum.EVER_TEAMS].sort()
		);
	});

	it('matches the frozen copy the migration inserts into already-seeded databases', () => {
		expect(new SeedPlatformChangelogContent1791000005610().rows.map((row) => [...row])).toEqual(templateRows);
	});

	it('fits every text in a MySQL varchar and gives every product a valid key', () => {
		for (const [platform, icon, title, , content, learnMore] of templateRows) {
			expect(CHANGELOG_PLATFORM_PATTERN.test(platform)).toBe(true);
			for (const text of [icon, title, content, learnMore]) {
				expect(text.length).toBeLessThanOrEqual(MYSQL_VARCHAR);
			}
		}
	});

	it('has no two entries of one product with the same title (the migration keys on them)', () => {
		const keys = templateRows.map(([platform, , title]) => `${platform}/${title}`);
		expect(new Set(keys).size).toBe(keys.length);
	});

	it("seeds a fresh database with Gauzy's entries stamped gauzy, then every other product's", () => {
		const rows = buildChangelogSeedRows();
		const gauzy = rows.filter((row) => row.platform === 'gauzy');
		expect(gauzy.map((row) => row.title)).toEqual(INITIAL_CHANGELOG_TEMPLATE.map((item) => item.title));
		expect(rows).toHaveLength(INITIAL_CHANGELOG_TEMPLATE.length + templateRows.length);
		expect(rows.filter((row) => row.platform === 'ever-teams').every((row) => row.isFeature === false)).toBe(true);
	});

	it('names no Ever host: each learn-more link is a named setting the deployment fills', () => {
		for (const [, , , , content, learnMore] of templateRows) {
			expect(content).not.toMatch(/\b(?:ever\.co|ever\.team|gauzy\.co)\b/);
			expect(['', 'everTeams', 'everTeamsDocs', 'ever']).toContain(learnMore);
		}
	});

	it('links the other products\' entries to the addresses the deployment sets, and to none when it sets none', () => {
		const settings = {
			WHATS_NEW_EVER_TEAMS_URL: 'https://teams.example.test',
			WHATS_NEW_EVER_TEAMS_DOCS_URL: 'https://docs.teams.example.test',
			WHATS_NEW_EVER_URL: 'https://ever.example.test'
		};
		const linked = buildChangelogSeedRows(settings);
		const link = (platform: string, title: string, rows = linked) =>
			rows.find((row) => row.platform === platform && row.title === title)?.learnMoreUrl;
		expect(link('ever-teams', "What's new and About")).toBe('https://teams.example.test');
		expect(link('ever-teams', 'Weekly time report')).toBe('https://docs.teams.example.test');
		expect(link('ever-platform', 'One Apps page')).toBe('https://ever.example.test');
		expect(link('ever-teams', 'See who is online')).toBe('');

		const unset = buildChangelogSeedRows({});
		expect(unset.filter((row) => row.platform !== 'gauzy').every((row) => row.learnMoreUrl === '')).toBe(true);
		// Gauzy's own entries keep the links they carry.
		expect(unset.filter((row) => row.platform === 'gauzy').map((row) => row.learnMoreUrl)).toEqual(
			linked.filter((row) => row.platform === 'gauzy').map((row) => row.learnMoreUrl)
		);
	});

	it('words the reworded entries as the follow-up migration rewords the databases seeded before', () => {
		const platform = Object.fromEntries(
			templateRows.filter(([product]) => product === 'ever-platform').map(([, , title, , content]) => [title, content])
		);
		for (const [title, content] of new RewordPlatformChangelogEntries1791000006900().rows) {
			expect(platform[title]).toBe(content);
		}
	});

	it('adds on a fresh database only what a migration has not already added', () => {
		const rows = buildChangelogSeedRows();
		const left = withoutExistingEntries(rows, [
			{ platform: 'ever-teams', title: 'Weekly time report' },
			{ platform: null, title: INITIAL_CHANGELOG_TEMPLATE[0].title }
		]);
		expect(left).toHaveLength(rows.length - 2);
		expect(left.some((row) => row.platform === 'ever-teams' && row.title === 'Weekly time report')).toBe(false);
	});

	it('gives the starter entries ids fixed by product and title', () => {
		expect(platformChangelogEntryId('ever-teams', 'Weekly time report')).toBe(
			platformChangelogEntryId('ever-teams', 'Weekly time report')
		);
		expect(platformChangelogEntryId('ever-teams', 'Weekly time report')).not.toBe(
			platformChangelogEntryId('ever-works', 'Weekly time report')
		);
		expect(platformChangelogEntryId('ever-teams', 'x')).toMatch(
			/^[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/
		);
	});
});
