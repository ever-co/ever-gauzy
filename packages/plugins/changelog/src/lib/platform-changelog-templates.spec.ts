// The plugin needs only these from the kernel; the real barrel boots the whole platform.
jest.mock('@gauzy/core', () => {
	const decorator = () => () => undefined;
	class CrudService {
		constructor(..._repositories: unknown[]) {}
	}
	class TenantOrganizationBaseEntity {}
	class MikroOrmBaseEntityRepository {}
	return {
		CrudService,
		TenantOrganizationBaseEntity,
		MikroOrmBaseEntityRepository,
		MultiORMEntity: decorator,
		MultiORMColumn: decorator
	};
});

import { ChangelogPlatformEnum, CHANGELOG_PLATFORM_PATTERN } from '@gauzy/contracts';
import { SeedPlatformChangelogContent1791000005610 } from '../../../../core/src/lib/database/migrations/1791000005610-SeedPlatformChangelogContent';
import { buildChangelogSeedRows } from './changelog.seed';
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
			item.learnMoreUrl ?? ''
		])
	);

	it('carries starter entries for every Ever product but Gauzy', () => {
		expect(Object.keys(PLATFORM_CHANGELOG_TEMPLATES).sort()).toEqual(
			[
				ChangelogPlatformEnum.EVER_PLATFORM,
				ChangelogPlatformEnum.EVER_TEAMS,
				ChangelogPlatformEnum.EVER_WORKS
			].sort()
		);
	});

	it('matches the frozen copy the migration inserts into already-seeded databases', () => {
		expect(new SeedPlatformChangelogContent1791000005610().rows.map((row) => [...row])).toEqual(templateRows);
	});

	it('fits every text in a MySQL varchar and gives every product a valid key', () => {
		for (const [platform, icon, title, , content, learnMoreUrl] of templateRows) {
			expect(CHANGELOG_PLATFORM_PATTERN.test(platform)).toBe(true);
			for (const text of [icon, title, content, learnMoreUrl]) {
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
});
