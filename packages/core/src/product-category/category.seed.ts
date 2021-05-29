import { Connection } from 'typeorm';
import { ProductCategory } from './product-category.entity';
import * as faker from 'faker';
import * as seed from './product-category.seed.json';
import { ProductCategoryTranslation } from './product-category-translation.entity';
import { IOrganization, ITenant } from '@gauzy/contracts';

export const createCategories = async (
	connection: Connection,
	tenant: ITenant,
	organizations: IOrganization[]
): Promise<ProductCategory[]> => {
	const seedProductCategories = [];

	for (const organization of organizations) {
		for (const seedProductCategory of seed) {
			const newCategory = new ProductCategory();
			const image = faker.image[seedProductCategory.fakerImageCategory]() || faker.image.abstract();

			newCategory.imageUrl = image;
			newCategory.organization = organization;
			newCategory.tenant = tenant;
			newCategory.translations = [];

			seedProductCategory.translations.forEach((translation) => {
				const newTranslation = new ProductCategoryTranslation();
				newTranslation.organization = organization;
				newTranslation.tenant = tenant;
				Object.assign(newTranslation, translation);
				newCategory.translations.push(newTranslation);
			});
			seedProductCategories.push(newCategory);
		}
	}
	return await insertProductCategories(connection, seedProductCategories);
};

const insertProductCategories = async (
	connection: Connection,
	categories: ProductCategory[]
): Promise<ProductCategory[]> => {
	return await connection.manager.save(categories);
};

export const createRandomCategories = async (
	connection: Connection,
	tenants: ITenant[],
	tenantOrganizationsMap: Map<ITenant, IOrganization[]>
): Promise<ProductCategory[]> => {
	const seedProductCategories: ProductCategory[] = [];

	for (const tenant of tenants) {
		const tenantOrgs = tenantOrganizationsMap.get(tenant);
		for (const tenantOrg of tenantOrgs) {
			for (const seedProductCategory of seed) {
				const newCategory = new ProductCategory();
				const image =
					faker.image[seedProductCategory.fakerImageCategory]() ||
					faker.image.abstract();

				newCategory.imageUrl = image;
				newCategory.organization = tenantOrg;
				newCategory.tenant = tenant;
				newCategory.translations = [];

				seedProductCategory.translations.forEach((translation) => {
					const newTranslation = new ProductCategoryTranslation();
					newTranslation.organization = tenantOrg;
					newTranslation.tenant = tenant;

					Object.assign(newTranslation, translation);
					newCategory.translations.push(newTranslation);
				});
				seedProductCategories.push(newCategory);
			}
		}
	}
	await insertProductCategories(connection, seedProductCategories);
	return seedProductCategories;
};
