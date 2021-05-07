import { Connection, IsNull, Not } from 'typeorm';
import * as faker from 'faker';
import { IHelpCenter, IHelpCenterArticle, IOrganization, ITenant } from '@gauzy/contracts';
import { HelpCenterArticle } from './help-center-article.entity';
import { HelpCenter } from './../help-center';

export const createHelpCenterArticle = async (
	connection: Connection,
	tenants: ITenant[],
	tenantOrganizationsMap: Map<ITenant, IOrganization[]>,
	numberOfHelpCenterArticle
): Promise<IHelpCenterArticle[]> => {
	const helpCenterArticles: IHelpCenterArticle[] = [];
	for await (const tenant of tenants) { 
		const organizations = tenantOrganizationsMap.get(tenant);
		for await (const organization of organizations) {
			const organizationId = organization.id;
			const tenantId = organization.tenantId;
			const helpCenters: IHelpCenter[] = await connection.manager.find(HelpCenter, {
				where: {
					parentId: Not(IsNull()),
					tenantId,
					organizationId
				}
			});

			for (let i = 0; i <= numberOfHelpCenterArticle; i++) {
				const article = new HelpCenterArticle();
				article.organizationId = organizationId;
				article.tenantId = tenantId;
				article.name = faker.name.title();
				article.description = faker.name.jobDescriptor();
				article.data = faker.commerce.productMaterial();
				const helpCenter = faker.random.arrayElement(helpCenters);
				article.categoryId = (helpCenter) ? helpCenter.id : null;
				article.draft = faker.datatype.boolean();
				article.privacy = faker.datatype.boolean();
				article.index = i;
				helpCenterArticles.push(article);
			}
		}
	}
	return await connection.manager.save(helpCenterArticles);
};
