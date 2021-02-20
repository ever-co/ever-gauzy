import { Connection } from 'typeorm';
import { Changelog } from './changelog.entity';
import { IChangelog } from '@gauzy/contracts';
import { INITIAL_CHANGELOG_TEMPLATE } from './initial-changelog-template';

export const createChangelog = async (
	connection: Connection
): Promise<IChangelog[]> => {
	return await new Promise<IChangelog[]>(async (resolve, reject) => {
		try {
			const changelog: IChangelog[] = [];
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
					changelog.push(entry);
				}
			}
			await insertChangelog(connection, changelog);
			resolve(changelog);
		} catch (err) {
			console.log('Error parsing changelog:', err);
			reject(null);
			return;
		}
	});
};

const insertChangelog = async (
	connection: Connection,
	changelog: IChangelog[]
): Promise<void> => {
	await connection
		.createQueryBuilder()
		.insert()
		.into(Changelog)
		.values(changelog)
		.execute();
};
