import { DataSource } from 'typeorm';
import { DEFAULT_CHANGELOG_PLATFORM, IChangelog } from '@gauzy/contracts';
import { whatsNewLinkUrl } from '@gauzy/core';
import { Changelog } from './changelog.entity';
import { INITIAL_CHANGELOG_TEMPLATE } from './initial-changelog-template';
import { PLATFORM_CHANGELOG_TEMPLATES, PlatformChangelogTemplate } from './platform-changelog-templates';

/**
 * The rows a fresh database starts with: Gauzy's entries, then the starter entries of every other product
 * that reads this table (Ever Teams, Ever Platform), each stamped with its product. The other products' learn-more
 * links are the addresses the deployment sets (`whatsNewLinkUrl`; none when it sets none).
 *
 * @param env - The deployment's settings (the process environment).
 */
export function buildChangelogSeedRows(env: Record<string, string | undefined> = process.env): IChangelog[] {
	const gauzy = INITIAL_CHANGELOG_TEMPLATE.map((item) => toRow(item, DEFAULT_CHANGELOG_PLATFORM));
	const others = Object.entries(PLATFORM_CHANGELOG_TEMPLATES).flatMap(([platform, items]) =>
		items.map((item: PlatformChangelogTemplate) =>
			toRow({ ...item, learnMoreUrl: whatsNewLinkUrl(item.learnMore, env) }, platform)
		)
	);
	return [...gauzy, ...others];
}

/**
 * The rows not there yet. A product's entry is known by its title: whichever of this seed and the migrations that
 * mirror it (`RefreshChangelogContent`, `SeedPlatformChangelogContent`) runs second adds nothing twice. Soft-deleted
 * rows count, so an entry the operator took down stays down.
 */
export function withoutExistingEntries(
	rows: IChangelog[],
	existing: ReadonlyArray<Pick<IChangelog, 'platform' | 'title'>>
): IChangelog[] {
	const key = ({ platform, title }: Pick<IChangelog, 'platform' | 'title'>) =>
		`${platform || DEFAULT_CHANGELOG_PLATFORM}/${title}`;
	const taken = new Set(existing.map(key));
	return rows.filter((row) => !taken.has(key(row)));
}

function toRow(item: IChangelog & { learnMore?: unknown }, platform: string): IChangelog {
	return {
		icon: item.icon,
		title: item.title,
		date: item.date,
		content: item.content,
		isFeature: item.isFeature ?? false,
		learnMoreUrl: item.learnMoreUrl ?? '',
		imageUrl: item.imageUrl ?? '',
		platform
	};
}

export const createChangelog = async (dataSource: DataSource): Promise<IChangelog[]> => {
	return await new Promise<IChangelog[]>(async (resolve, reject) => {
		try {
			const existing = await dataSource
				.getRepository(Changelog)
				.find({ select: { platform: true, title: true }, withDeleted: true });
			const changelogs = withoutExistingEntries(buildChangelogSeedRows(), existing);
			if (changelogs.length) {
				await insertChangelog(dataSource, changelogs);
			}
			resolve(changelogs);
		} catch (err) {
			console.log('Error parsing changelog:', err);
			reject(null);
			return;
		}
	});
};

const insertChangelog = async (dataSource: DataSource, changelogs: IChangelog[]): Promise<void> => {
	await dataSource.createQueryBuilder().insert().into(Changelog).values(changelogs).execute();
};
