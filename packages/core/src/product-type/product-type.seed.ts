import * as seed from './product-type.seed.json';
import { DataSource } from 'typeorm';
import { Tenant } from '../tenant/tenant.entity';
import { IOrganization, ProductTypesIconsEnum } from '@gauzy/contracts';
import { ProductType } from './product-type.entity';
import { faker } from '@ever-co/faker';
import { ProductCategory } from '../product-category/product-category.entity';
import { Product } from '../product/product.entity';
import { ProductTypeTranslation } from './product-type-translation.entity';

export const createDefaultProductTypes = async (
	dataSource: DataSource,
	organizations: IOrganization[]
): Promise<ProductType[]> => {
	const seedProductTypes = [];

	organizations.forEach(async (organization) => {
		seed.forEach((seedProductType) => {
			const newType = new ProductType();

			newType.icon = seedProductType.icon;
			newType.organization = organization;
			newType.translations = [];

			seedProductType.translations.forEach((translation) => {
				const newTranslation = new ProductTypeTranslation();
				Object.assign(newTranslation, translation);
				newType.translations.push(newTranslation);
			});

			seedProductTypes.push(newType);
		});
	});

	await insertProductTypes(dataSource, seedProductTypes);

	return seedProductTypes;
};

const insertProductTypes = async (
	dataSource: DataSource,
	productTypes: ProductType[]
): Promise<void> => {
	await dataSource.manager.save(productTypes);
};

export const createRandomProductType = async (
	dataSource: DataSource,
	tenants: Tenant[],
	tenantOrganizationsMap: Map<Tenant, IOrganization[]>
): Promise<ProductType[]> => {
	if (!tenantOrganizationsMap) {
		console.warn(
			'Warning: tenantOrganizationsMap not found, ProductType will not be created'
		);
		return;
	}

	console.log('createRandomProductType');

	const productTypes: ProductType[] = [];

	for (const tenant of tenants) {
		const tenantOrgs = tenantOrganizationsMap.get(tenant);
		for (const tenantOrg of tenantOrgs) {
			const productCategories = await dataSource.manager.find(
				ProductCategory,
				{
					where: [{ organization: tenantOrg }]
				}
			);
			for (const productCategory of productCategories) {
				const products = await dataSource.manager.find(Product, {
					where: [{ category: productCategory }]
				});

				const productType = new ProductType();

				const productTypeTranslation: ProductTypeTranslation[] = [];

				productType.icon = faker.random.arrayElement(
					Object.keys(ProductTypesIconsEnum)
				);
				productType.products = products;
				productType.organization = tenantOrg;
				productType.translations = productTypeTranslation;

				productTypes.push(productType);
			}
		}
	}

	await dataSource.manager.save(productTypes);
};
