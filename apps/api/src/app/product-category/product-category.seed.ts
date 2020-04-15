import { Connection } from 'typeorm';
import { Organization } from '@gauzy/models';
import { ProductCategory } from './product-category.entity';

export const createProductCategories = async (
	connection: Connection,
	organization: Organization
): Promise<ProductCategory[]> => {
	const productCategories = [];

	const productCategory1 = new ProductCategory();
	productCategory1.name = 'product category 1';
	productCategory1.organizationId = organization.id;
	productCategories.push(productCategory1);

	const productCategory2 = new ProductCategory();
	productCategory2.name = 'product category 2';
	productCategory2.organizationId = organization.id;
	productCategories.push(productCategory2);

	const productCategory3 = new ProductCategory();
	productCategory3.name = 'product category 3';
	productCategory3.organizationId = organization.id;
	productCategories.push(productCategory3);

	insertProductCategory(connection, productCategory1);
	insertProductCategory(connection, productCategory2);
	insertProductCategory(connection, productCategory3);

	return productCategories;
};

const insertProductCategory = async (
	connection: Connection,
	category: ProductCategory
): Promise<void> => {
	await connection.manager.save(category);
};
