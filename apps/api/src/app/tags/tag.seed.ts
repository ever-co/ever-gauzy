import { Connection } from 'typeorm';
import * as faker from 'faker';
import { Tag } from './tag.entity';

export const createTags = async (connection: Connection): Promise<Tag[]> => {
	const tags: Tag[] = [];
	const tagNames = [
		'Program',
		'Web',
		'Mobile',
		'Frontend',
		'Backend',
		'Database',
		'Authentication',
		'Security',
		'Dashboard',
		'VIP',
		'Urgent'
	];

	for (const name of tagNames) {
		const tag = new Tag();
		tag.name = name;
		tag.description = '';
		tag.color = faker.commerce.color();
		tags.push(tag);
	}

	await connection
		.createQueryBuilder()
		.insert()
		.into(Tag)
		.values(tags)
		.execute();

	return tags;
};
