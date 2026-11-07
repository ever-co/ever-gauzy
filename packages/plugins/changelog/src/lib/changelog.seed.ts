import { DataSource } from 'typeorm';
import { DEFAULT_CHANGELOG_PLATFORM, IChangelog } from '@gauzy/contracts';
import { Changelog } from './changelog.entity';
import { INITIAL_CHANGELOG_TEMPLATE } from './initial-changelog-template';
import { PLATFORM_CHANGELOG_TEMPLATES } from './platform-changelog-templates';

/**
 * The rows a fresh database starts with: Gauzy's entries, then the starter entries of every other product
 * that reads this table (Ever Teams, Ever Works, Ever Platform), each stamped with its product.
 */
export function buildChangelogSeedRows(): IChangelog[] {
	const gauzy = INITIAL_CHANGELOG_TEMPLATE.map((item) => toRow(item, DEFAULT_CHANGELOG_PLATFORM));
	const others = Object.entries(PLATFORM_CHANGELOG_TEMPLATES).flatMap(([platform, items]) =>
		items.map((item) => toRow(item, platform))
	);
	return [...gauzy, ...others];
}

function toRow(item: IChangelog, platform: string): IChangelog {
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
			const changelogs = buildChangelogSeedRows();
			await insertChangelog(dataSource, changelogs);
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
