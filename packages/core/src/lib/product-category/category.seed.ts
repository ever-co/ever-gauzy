import { DataSource } from 'typeorm';
import { ProductCategory } from './product-category.entity';
import { faker } from '@faker-js/faker';
import * as categories from './product-category.seed.json';
import { ProductCategoryTranslation } from './product-category-translation.entity';
import { IOrganization, ITenant } from '@gauzy/contracts';

export const createCategories = async (
	dataSource: DataSource,
	tenant: ITenant,
	organizations: IOrganization[]
): Promise<ProductCategory[]> => {
	const seedProductCategories = [];

	for await (const organization of organizations) {
		for await (const seedProductCategory of categories) {
			const { category } = seedProductCategory;
			const image = faker.image.urlLoremFlickr({ category });

			const newCategory = new ProductCategory();
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

export const createRandomProductCategories = async (
	dataSource: DataSource,
	tenants: ITenant[],
	tenantOrganizationsMap: Map<ITenant, IOrganization[]>
): Promise<ProductCategory[]> => {
	const seedProductCategories: ProductCategory[] = [];
	for await (const tenant of tenants) {
		const organizations = tenantOrganizationsMap.get(tenant);
		for await (const organization of organizations) {
			for (const seedProductCategory of categories) {
				const { category } = seedProductCategory;
				const image = faker.image.urlLoremFlickr({ category });

				const newCategory = new ProductCategory();
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
	}
	await insertProductCategories(dataSource, seedProductCategories);
	return seedProductCategories;
};
