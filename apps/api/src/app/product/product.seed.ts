import { Connection } from 'typeorm';
import { Product } from './product.entity';
import { ProductType } from '../product-type/product-type.entity';
import { ProductCategory } from '../product-category/product-category.entity';
import * as faker from 'faker';
import { Organization } from '@gauzy/models';
import { Tenant } from '../tenant/tenant.entity';

export const createDefaultProducts = async (
	connection: Connection,
	tenant: Tenant,
	organizations?: Organization[]
) => {
	const productTypes = await connection.manager.find(ProductType);
	const productCategories = await connection.manager.find(ProductCategory);
	const products = [];

	for (let i = 0; i <= 30; i++) {
		const product = new Product();
		product.name = faker.commerce.productName();
		product.code = faker.lorem.word();
		product.type =
			productTypes[Math.floor(Math.random() * productTypes.length)];
		product.category =
			productCategories[
				Math.floor(Math.random() * productCategories.length)
			];
		product.description = faker.lorem.words();
		product.tenant = tenant;

		products.push(product);
	}

	await insertProduct(connection, products);
};

const insertProduct = async (
	connection: Connection,
	products: Product[]
): Promise<void> => {
	await connection.manager.save(products);
};
