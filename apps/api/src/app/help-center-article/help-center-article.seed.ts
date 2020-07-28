import { Connection } from 'typeorm';
import { HelpCenterArticle } from './help-center-article.entity';
import * as faker from 'faker';

export const createRandomHelpCenterArticle = async (
	connection: Connection,
	numberOfHelpCenterArticle
): Promise<HelpCenterArticle[]> => {
	let HelpCenterArticles: HelpCenterArticle[] = [];

	const booleanAry = [true, false];

	for (let i = 0; i <= numberOfHelpCenterArticle; i++) {
		let article = new HelpCenterArticle();

		article.name = faker.name.title();
		article.description = faker.name.jobDescriptor();
		article.data = faker.commerce.productMaterial();
		article.categoryId = (Math.floor(Math.random() * 99999) + 1).toString();
		article.draft = booleanAry[Math.random() > 0.5 ? 1 : 0];
		article.privacy = booleanAry[Math.random() > 0.5 ? 1 : 0];
		article.index = Math.floor(Math.random() * 99999) + 1;

		HelpCenterArticles.push(article);
	}
	await insertRandomHelpCenterArticle(connection, HelpCenterArticles);
	return HelpCenterArticles;
};

const insertRandomHelpCenterArticle = async (
	connection: Connection,
	data: HelpCenterArticle[]
) => {
	await connection
		.createQueryBuilder()
		.insert()
		.into(HelpCenterArticle)
		.values(data)
		.execute();
};
