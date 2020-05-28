import { Connection } from 'typeorm';
import { Organization } from '@gauzy/models';
import { ProductCategory } from './product-category.entity';
import * as seed from './product-types.seed.json';
import * as faker from 'faker';

export const createDefaultProductCategories = async (
	connection: Connection,
	organizations: Organization[]
): Promise<ProductCategory[]> => {
	const seedProductCategories = [];

	organizations.forEach(async (organization) => {
		let image = faker.image.abstract();
		seed.forEach(async (seedProductCatery) => {
			const newCategory = new ProductCategory();
			image =
				faker.image[seedProductCatery.fakerImageCategory]() ||
				faker.image.abstract();
			newCategory.name = seedProductCatery.name;
			newCategory.description = seedProductCatery.description;
			newCategory.imageUrl = image;
			newCategory.organization = organization;
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
