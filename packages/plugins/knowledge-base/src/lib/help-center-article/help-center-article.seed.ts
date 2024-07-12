import { DataSource, IsNull, Not } from 'typeorm';
import { faker } from '@faker-js/faker';
import { IHelpCenter, IHelpCenterArticle, IOrganization, ITenant } from '@gauzy/contracts';
import { HelpCenterArticle } from './help-center-article.entity';
import { HelpCenter } from './../help-center';

export const createHelpCenterArticle = async (
	dataSource: DataSource,
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
			const helpCenters: IHelpCenter[] = await dataSource.manager.findBy(HelpCenter, {
				parentId: Not(IsNull()),
				tenantId,
				organizationId
			});
			for (let i = 0; i <= numberOfHelpCenterArticle; i++) {
				const article = new HelpCenterArticle();
				article.organizationId = organizationId;
				article.tenantId = tenantId;
				article.name = faker.person.jobTitle();
				article.description = faker.person.jobDescriptor();
				article.data = faker.commerce.productMaterial();
				const helpCenter = faker.helpers.arrayElement(helpCenters);
				article.categoryId = (helpCenter) ? helpCenter.id : null;
				article.draft = faker.datatype.boolean();
				article.privacy = faker.datatype.boolean();
				article.index = i;
				helpCenterArticles.push(article);
			}
		}
	}
	return await dataSource.manager.save(helpCenterArticles);
};
