import { Connection } from 'typeorm';
import { IOrganization, ITenant } from '@gauzy/contracts';
import { ProductVariantPrice } from './product-variant-price.entity';
import * as faker from 'faker';
import { ProductCategory } from '../product-category/product-category.entity';
import { Product } from '../product/product.entity';
import { ProductVariant } from '../product-variant/product-variant.entity';
import { environment as env } from '@gauzy/config';

export const createRandomProductVariantPrice = async (
	connection: Connection,
	tenants: ITenant[],
	tenantOrganizationsMap: Map<ITenant, IOrganization[]>
): Promise<ProductVariantPrice[]> => {
	if (!tenantOrganizationsMap) {
		console.warn(
			'Warning: tenantOrganizationsMap not found, Product Variant will not be created'
		);
		return;
	}

	const productVariantPrices: ProductVariantPrice[] = [];

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
						const productVariantPrice = new ProductVariantPrice();

						productVariantPrice.productVariant = productVariant;
						productVariantPrice.unitCost = faker.datatype.number(
							10000
						);
						productVariantPrice.unitCostCurrency =
							tenantOrg.currency || env.defaultCurrency;
						productVariantPrice.retailPrice = faker.datatype.number(
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

	await connection.manager.save(productVariantPrices);
};
