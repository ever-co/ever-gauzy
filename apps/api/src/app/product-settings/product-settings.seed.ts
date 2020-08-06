import { Connection } from 'typeorm';
import { Tenant } from '../tenant/tenant.entity';
import { Organization } from '@gauzy/models';
import { ProductVariantSettings } from './product-settings.entity';
import * as faker from 'faker';
import { ProductCategory } from '../product-category/product-category.entity';
import { Product } from '../product/product.entity';
import { ProductVariant } from '../product-variant/product-variant.entity';

export const createRandomProductVariantSettings = async (
	connection: Connection,
	tenants: Tenant[],
	tenantOrganizationsMap: Map<Tenant, Organization[]>
): Promise<ProductVariantSettings[]> => {
	if (!tenantOrganizationsMap) {
		console.warn(
			'Warning: tenantOrganizationsMap not found, Product Options  will not be created'
		);
		return;
	}
	const productVariantSettings: ProductVariantSettings[] = [];

	for (const tenant of tenants) {
		const tenantOrgs = tenantOrganizationsMap.get(tenant);
		for (const tenantOrg of tenantOrgs) {
			const productCategories = await connection.manager.find(
				ProductCategory,
				{
					where: [{ organization: tenantOrg }]
				}
			);
			for (const productCategory of productCategories) {
				const products = await connection.manager.find(Product, {
					where: [{ category: productCategory }]
				});
				for (const product of products) {
					const productVariants = await connection.manager.find(
						ProductVariant,
						{
							where: [{ productId: product.id }]
						}
					);
					for (const productVariant of productVariants) {
						const productVariantSetting = new ProductVariantSettings();
						productVariantSetting.productVariant = productVariant;
						productVariantSetting.isSubscription = faker.random.boolean();
						productVariantSetting.isPurchaseAutomatically = faker.random.boolean();
						productVariantSetting.canBeSold = faker.random.boolean();
						productVariantSetting.canBePurchased = faker.random.boolean();
						productVariantSetting.canBeCharged = faker.random.boolean();
						productVariantSetting.canBeRented = faker.random.boolean();
						productVariantSetting.isEquipment = faker.random.boolean();
						productVariantSetting.trackInventory = faker.random.boolean();

						productVariantSettings.push(productVariantSetting);
					}
				}
			}
		}
	}

	await connection.manager.save(productVariantSettings);
};
