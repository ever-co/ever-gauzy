import { Connection } from 'typeorm';
import * as faker from 'faker';
import { IOrganization, ITenant, LanguagesEnum } from '@gauzy/contracts';
import { Product, ProductCategory, ProductTranslation, ProductType } from './../core/entities/internal';

export const createDefaultProducts = async (
	connection: Connection,
	tenant: ITenant,
	organization: IOrganization
) => {
	const productTypes = await connection.manager.find(ProductType);
	const productCategories = await connection.manager.find(ProductCategory);
	const products = [];

	for (let i = 0; i <= 30; i++) {
		const product = new Product();

		const translation = new ProductTranslation();
		translation.organization = organization;
		translation.tenant = tenant;
		translation.languageCode = LanguagesEnum.ENGLISH;
		translation.name = faker.commerce.productName();
		translation.description = faker.lorem.words();

		product.code = faker.lorem.word();
		product.productType =
			productTypes[Math.floor(Math.random() * productTypes.length)];
		product.productCategory =
			productCategories[
				Math.floor(Math.random() * productCategories.length)
			];
		product.translations = [translation];
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
	tenants: ITenant[],
	tenantOrganizationsMap: Map<ITenant, IOrganization[]>
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

			const translation = new ProductTranslation();
			translation.organization = tenantOrg;
			translation.tenant = tenant;
			translation.languageCode = LanguagesEnum.ENGLISH;

			translation.name = faker.commerce.productName();
			translation.description = faker.lorem.words();

			product.translations = [translation];
			product.code = faker.lorem.word();
			product.productType =
				productTypes[Math.floor(Math.random() * productTypes.length)];
			product.productCategory =
				productCategories[
					Math.floor(Math.random() * productCategories.length)
				];
			product.tenant = tenant;
			product.organization = tenantOrg;

			products.push(product);
		}
	}

	await connection.manager.save(products);
};
