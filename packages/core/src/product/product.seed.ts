import { DataSource } from 'typeorm';
import { faker } from '@faker-js/faker';
import { IOrganization, ITenant, LanguagesEnum } from '@gauzy/contracts';
import { Product, ProductCategory, ProductTranslation, ProductType } from './../core/entities/internal';

export const createDefaultProducts = async (
	dataSource: DataSource,
	tenant: ITenant,
	organization: IOrganization
) => {
	const productTypes = await dataSource.manager.find(ProductType);
	const productCategories = await dataSource.manager.find(ProductCategory);
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

	await insertProduct(dataSource, products);
};

const insertProduct = async (
	dataSource: DataSource,
	products: Product[]
): Promise<void> => {
	await dataSource.manager.save(products);
};

export const createRandomProduct = async (
	dataSource: DataSource,
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
		const { id: tenantId } = tenant;
		const tenantOrgs = tenantOrganizationsMap.get(tenant);
		for (const tenantOrg of tenantOrgs) {
			const { id: organizationId } = tenantOrg;
			const productCategories = await dataSource.manager.find(ProductCategory, {
				where: {
					tenantId,
					organizationId
				}
			});
			const productTypes = await dataSource.manager.find(ProductType, {
				where: {
					tenantId,
					organizationId
				}
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

	await dataSource.manager.save(products);
};
