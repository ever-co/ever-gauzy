import { Connection } from 'typeorm';
import { Organization } from '@gauzy/models';
import { ProductCategory } from './product-category.entity';

export const createDefaultProductCategories = async (
	connection: Connection,
	organizations: Organization[]
): Promise<ProductCategory[]> => {
	const productCategories: ProductCategory[] = [];

	//TODO: Get this from env ?
	organizations.forEach((organization) => {
		for (let i = 0; i < 3; i++) {
			const category = new ProductCategory();
			category.name = 'product category';
			category.organization = organization;
			productCategories.push(category);
		}
	});

	insertProductCategories(connection, productCategories);

	return productCategories;
};

const insertProductCategories = async (
	connection: Connection,
	categories: ProductCategory[]
): Promise<void> => {
	await connection.manager.save(categories);
};
