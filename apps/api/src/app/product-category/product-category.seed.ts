import { Connection } from 'typeorm';
import { Organization } from '@gauzy/models';
import { ProductCategory } from './product-category.entity';
import * as seed from './product-category.seed.json';
import * as faker from 'faker';
import { ProductCategoryTranslation } from './product-category-translation.entity';

export const createDefaultProductCategories = async (
	connection: Connection,
	organizations: Organization[]
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

	await insertProductCategories(connection, seedProductCategories);

	return seedProductCategories;
};

const insertProductCategories = async (
	connection: Connection,
	categories: ProductCategory[]
): Promise<void> => {
	await connection.manager.save(categories);
};
