import { Connection } from 'typeorm';
import * as faker from 'faker';
import { IHelpCenterArticle, IOrganization } from '@gauzy/contracts';
import { HelpCenterArticle } from './help-center-article.entity';

export const createHelpCenterArticle = async (
	connection: Connection,
	organizations: IOrganization[],
	numberOfHelpCenterArticle
): Promise<IHelpCenterArticle[]> => {
	const helpCenterArticles: IHelpCenterArticle[] = [];

	const booleanAry = [true, false];
	for (let i = 0; i <= numberOfHelpCenterArticle; i++) {
		organizations.forEach((organization: IOrganization) => {
			const article = new HelpCenterArticle();
			article.organization = organization;
			article.tenantId = organization.tenantId;
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

	return await connection.manager.save(helpCenterArticles);
};
