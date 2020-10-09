import { Connection } from 'typeorm';
import { Product } from './product.entity';
import { ProductType } from '../product-type/product-type.entity';
import { ProductCategory } from '../product-category/product-category.entity';
import * as faker from 'faker';
import { IOrganization } from '@gauzy/models';
import { Tenant } from '../tenant/tenant.entity';

export const createDefaultProducts = async (
	connection: Connection,
	tenant: Tenant,
	organization: IOrganization
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
		product.organization = organization;
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

export const createRandomProduct = async (
	connection: Connection,
	tenants: Tenant[],
	tenantOrganizationsMap: Map<Tenant, IOrganization[]>
): Promise<Product[]> => {
	if (!tenantOrganizationsMap) {
		console.warn(
			'Warning: tenantOrganizationsMap not found, Product will not be created'
		);
		return;
	}

	const products: Product[] = [];

	for (const tenant of tenants) {
		const tenantOrgs = tenantOrganizationsMap.get(tenant);
		for (const tenantOrg of tenantOrgs) {
			const productCategories = await connection.manager.find(
				ProductCategory,
				{
					where: [{ organization: tenantOrg }]
				}
			);
			const productTypes = await connection.manager.find(ProductType, {
				where: [{ organization: tenantOrg }]
			});
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
			product.organization = tenantOrg;

			products.push(product);
		}
	}

	await connection.manager.save(products);
};
