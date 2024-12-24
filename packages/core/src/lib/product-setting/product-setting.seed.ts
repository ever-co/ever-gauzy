import { DataSource } from 'typeorm';
import { IOrganization, IProductVariantSetting, ITenant } from '@gauzy/contracts';
import { ProductVariantSetting } from './product-setting.entity';
import { faker } from '@faker-js/faker';
import { ProductCategory } from '../product-category/product-category.entity';
import { Product } from '../product/product.entity';
import { ProductVariant } from '../product-variant/product-variant.entity';

export const createRandomProductVariantSettings = async (
	dataSource: DataSource,
	tenants: ITenant[],
	tenantOrganizationsMap: Map<ITenant, IOrganization[]>
): Promise<IProductVariantSetting[]> => {
	if (!tenantOrganizationsMap) {
		console.warn(
			'Warning: tenantOrganizationsMap not found, Product Options  will not be created'
		);
		return;
	}
	const productVariantSettings: IProductVariantSetting[] = [];

	for (const tenant of tenants) {
		const tenantOrgs = tenantOrganizationsMap.get(tenant);
		for (const tenantOrg of tenantOrgs) {
			const productCategories = await dataSource.manager.find(
				ProductCategory,
				{
					where: {
						organizationId: tenantOrg.id
					}
				}
			);
			for (const productCategory of productCategories) {
				const products = await dataSource.manager.find(Product, {
					where: {
						productCategoryId: productCategory.id
					}
				});
				for (const product of products) {
					const productVariants = await dataSource.manager.find(
						ProductVariant,
						{
							where: [{ productId: product.id }]
						}
					);
					for (const productVariant of productVariants) {
						const productVariantSetting = new ProductVariantSetting();
						productVariantSetting.productVariant = productVariant;
						productVariantSetting.isSubscription = faker.datatype.boolean();
						productVariantSetting.isPurchaseAutomatically = faker.datatype.boolean();
						productVariantSetting.canBeSold = faker.datatype.boolean();
						productVariantSetting.canBePurchased = faker.datatype.boolean();
						productVariantSetting.canBeCharged = faker.datatype.boolean();
						productVariantSetting.canBeRented = faker.datatype.boolean();
						productVariantSetting.isEquipment = faker.datatype.boolean();
						productVariantSetting.trackInventory = faker.datatype.boolean();
						productVariantSetting.tenant = tenant;
						productVariantSetting.organization = tenantOrg;

						productVariantSettings.push(productVariantSetting);
					}
				}
			}
		}
	}

	await dataSource.manager.save(productVariantSettings);
};
