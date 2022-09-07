import { DataSource } from 'typeorm';
import { IOrganization, ITenant } from '@gauzy/contracts';
import { ProductType } from './product-type.entity';
import * as seed from './product-type.seed.json';
import { ProductTypeTranslation } from './product-type-translation.entity';

export const createDefaultProductType = async (
	dataSource: DataSource,
	tenant: ITenant,
	organizations: IOrganization[]
): Promise<ProductType[]> => {
	const seedProductTypes: ProductType[] = [];
	for (const organization of organizations) {
		const productTypes = await generateProductType(
			tenant,
			organization
		);
		seedProductTypes.push(...productTypes);
	}
	return await insertProductTypes(dataSource, seedProductTypes);
};

const insertProductTypes = async (
	dataSource: DataSource,
	productTypes: ProductType[]
): Promise<ProductType[]> => {
	return await dataSource.manager.save(productTypes);
};

export const createRandomProductType = async (
	dataSource: DataSource,
	tenants: ITenant[],
	tenantOrganizationsMap: Map<ITenant, IOrganization[]>
): Promise<ProductType[]> => {
	if (!tenantOrganizationsMap) {
		console.warn(
			'Warning: tenantOrganizationsMap not found, Random Product Type will not be created'
		);
		return;
	}
	const seedProductTypes: ProductType[] = [];
	for await (const tenant of tenants) {
		const organizations = tenantOrganizationsMap.get(tenant);
		for await (const organization of organizations) {
			const productTypes = await generateProductType(
				tenant,
				organization
			);
			seedProductTypes.push(...productTypes);
		}
	}
	return await insertProductTypes(dataSource, seedProductTypes);
};

const generateProductType = async (
	tenant: ITenant,
	organization: IOrganization
): Promise<ProductType[]> => {
	const productTypes: ProductType[] = [];
	for (const seedProductType of seed) {
		const productType = new ProductType();
		productType.icon = seedProductType.icon;
		productType.organization = organization;
		productType.tenant = tenant;
		productType.translations = [];
		seedProductType.translations.forEach((translation) => {
			const newTranslation = new ProductTypeTranslation();
			newTranslation.organization = organization;
			newTranslation.tenant = tenant;
			Object.assign(newTranslation, translation);
			productType.translations.push(newTranslation);
		});
		productTypes.push(productType);
	}
	return productTypes;
};
