import { Connection } from 'typeorm';
import { HelpCenterArticle } from './help-center-article.entity';
import * as faker from 'faker';
import { Organization } from '../organization/organization.entity';

export const createHelpCenterArticle = async (
	connection: Connection,
	organizations: Organization[],
	numberOfHelpCenterArticle
): Promise<HelpCenterArticle[]> => {
	const helpCenterArticles: HelpCenterArticle[] = [];

	const booleanAry = [true, false];
	for (let i = 0; i <= numberOfHelpCenterArticle; i++) {
		organizations.forEach((organization: Organization) => {
			const article = new HelpCenterArticle();
			article.organization = organization;
			article.tenant = organization.tenant;
			article.name = faker.name.title();
			article.description = faker.name.jobDescriptor();
			article.data = faker.commerce.productMaterial();
			article.categoryId = (
				Math.floor(Math.random() * 99999) + 1
			).toString();
			article.draft = booleanAry[Math.random() > 0.5 ? 1 : 0];
			article.privacy = booleanAry[Math.random() > 0.5 ? 1 : 0];
			article.index = Math.floor(Math.random() * 99999) + 1;

			helpCenterArticles.push(article);
		});
	}

	await insertRandomHelpCenterArticle(connection, helpCenterArticles);
	return helpCenterArticles;
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
