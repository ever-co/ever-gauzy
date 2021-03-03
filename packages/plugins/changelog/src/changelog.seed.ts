import { Connection } from 'typeorm';
import { IChangelog } from '@gauzy/contracts';
import { Changelog } from './changelog.entity';
import { INITIAL_CHANGELOG_TEMPLATE } from './initial-changelog-template';

export const createChangelog = async (
	connection: Connection
): Promise<IChangelog[]> => {
	return await new Promise<IChangelog[]>(async (resolve, reject) => {
		try {
			const changelogs: IChangelog[] = [];
			const entries = INITIAL_CHANGELOG_TEMPLATE;
			for (const key of Object.keys(entries)) {
				if (entries.hasOwnProperty(key)) {
					const entry: IChangelog = {
						icon: entries[key].icon,
						title: entries[key].title,
						date: entries[key].date,
						content: entries[key].content,
						learnMoreUrl: entries[key].learnMoreUrl
					};
					changelogs.push(entry);
				}
			}
			await insertChangelog(connection, changelogs);
			resolve(changelogs);
		} catch (err) {
			console.log('Error parsing changelog:', err);
			reject(null);
			return;
		}
	});
};

const insertChangelog = async (
	connection: Connection,
	changelogs: IChangelog[]
): Promise<void> => {
	await connection
		.createQueryBuilder()
		.insert()
		.into(Changelog)
		.values(changelogs)
		.execute();
};
