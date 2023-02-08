import { DataSource } from 'typeorm';
import { IOrganization } from '@gauzy/contracts';
import { ProductCategory } from './product-category.entity';
import * as seed from './product-category.seed.json';
import { faker } from '@faker-js/faker';
import { ProductCategoryTranslation } from './product-category-translation.entity';

export const createDefaultProductCategories = async (
	dataSource: DataSource,
	organizations: IOrganization[]
): Promise<ProductCategory[]> => {
	const seedProductCategories = [];

	organizations.forEach(async (organization) => {
		let image = faker.image.abstract();
		seed.forEach(async (seedProductCategory) => {
			const newCategory = new ProductCategory();
			image =
				faker.image[seedProductCategory.fakerImageCategory]() ||
				faker.image.abstract();

			newCategory.imageUrl = image;
			newCategory.organization = organization;
			newCategory.translations = [];

			seedProductCategory.translations.forEach((translation) => {
				const newTranslation = new ProductCategoryTranslation();
				Object.assign(newTranslation, translation);
				newCategory.translations.push(newTranslation);
			});
			seedProductCategories.push(newCategory);
		});
	});

	await insertProductCategories(dataSource, seedProductCategories);

	return seedProductCategories;
};

const insertProductCategories = async (
	dataSource: DataSource,
	categories: ProductCategory[]
): Promise<void> => {
	await dataSource.manager.save(categories);
};
