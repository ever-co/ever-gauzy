import { DataSource } from 'typeorm';
import { IOrganization, IProductVariantPrice, ITenant } from '@gauzy/contracts';
import { ProductVariantPrice } from './product-variant-price.entity';
import { faker } from '@faker-js/faker';
import { ProductCategory } from '../product-category/product-category.entity';
import { Product } from '../product/product.entity';
import { ProductVariant } from '../product-variant/product-variant.entity';
import { environment as env } from '@gauzy/config';

export const createRandomProductVariantPrice = async (
	dataSource: DataSource,
	tenants: ITenant[],
	tenantOrganizationsMap: Map<ITenant, IOrganization[]>
): Promise<IProductVariantPrice[]> => {
	if (!tenantOrganizationsMap) {
		console.warn(
			'Warning: tenantOrganizationsMap not found, Product Variant will not be created'
		);
		return;
	}

	const productVariantPrices: IProductVariantPrice[] = [];

	for (const tenant of tenants) {
		const { id: tenantId } = tenant;
		const tenantOrgs = tenantOrganizationsMap.get(tenant);
		for (const tenantOrg of tenantOrgs) {
			const { id: organizationId } = tenantOrg;
			const productCategories = await dataSource.manager.find(ProductCategory, {
				where: {
					organizationId,
					tenantId
				}
			});
			for (const productCategory of productCategories) {
				const products = await dataSource.manager.find(Product, {
					where: {
						productCategoryId: productCategory.id
					}
				});
				for (const product of products) {
					const productVariants = await dataSource.manager.find(ProductVariant, {
						where: {
							productId: product.id
						}
					});
					for (const productVariant of productVariants) {
						const productVariantPrice: IProductVariantPrice = new ProductVariantPrice();

						productVariantPrice.productVariant = productVariant;
						productVariantPrice.unitCost = faker.number.int(
							10000
						);
						productVariantPrice.unitCostCurrency =
							tenantOrg.currency || env.defaultCurrency;
						productVariantPrice.retailPrice = faker.number.int(
							productVariantPrice.unitCost
						);
						productVariantPrice.retailPriceCurrency =
							tenantOrg.currency || env.defaultCurrency;
						productVariantPrice.tenant = tenant;
						productVariant.organization = tenantOrg;

						productVariantPrices.push(productVariantPrice);
					}
				}
			}
		}
	}

	await dataSource.manager.save(productVariantPrices);
};
