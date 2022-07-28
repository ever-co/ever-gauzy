import { DataSource } from 'typeorm';
import { ProductCategory } from './product-category.entity';
import { faker } from '@ever-co/faker';
import * as seed from './product-category.seed.json';
import { ProductCategoryTranslation } from './product-category-translation.entity';
import { IOrganization, ITenant } from '@gauzy/contracts';

export const createCategories = async (
	dataSource: DataSource,
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
	return await insertProductCategories(dataSource, seedProductCategories);
};

const insertProductCategories = async (
	dataSource: DataSource,
	categories: ProductCategory[]
): Promise<ProductCategory[]> => {
	return await dataSource.manager.save(categories);
};

export const createRandomCategories = async (
	dataSource: DataSource,
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
	await insertProductCategories(dataSource, seedProductCategories);
	return seedProductCategories;
};
