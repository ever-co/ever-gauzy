import * as seed from './product-type.seed.json';
import { DataSource } from 'typeorm';
import { Tenant } from '../tenant/tenant.entity';
import { IOrganization, ProductTypesIconsEnum } from '@gauzy/contracts';
import { ProductType } from './product-type.entity';
import { faker } from '@faker-js/faker';
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
			for (const productCategory of productCategories) {
				const products = await dataSource.manager.find(Product, {
					where: {
						tenantId,
						organizationId,
						productCategoryId: productCategory.id
					}
				});
				const productType = new ProductType();
				const productTypeTranslation: ProductTypeTranslation[] = [];

				productType.icon = faker.helpers.arrayElement(
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
