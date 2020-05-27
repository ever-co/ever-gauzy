import { Connection } from 'typeorm';
import { Organization } from '@gauzy/models';
import { ProductCategory } from './product-category.entity';
import { environment as env } from '@env-api/environment';

export const createDefaultProductCategories = async (
	connection: Connection,
	organizations: Organization[]
): Promise<ProductCategory[]> => {
	const seedProductCategories = [];

	organizations.forEach(async (organization) => {
		env.defaultProductCategories.forEach((seedProductCatery) => {
			const newCategory = new ProductCategory();
			newCategory.name = seedProductCatery.name;
			newCategory.description = seedProductCatery.description;
			newCategory.imageUrl = seedProductCatery.imageUrl;
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
