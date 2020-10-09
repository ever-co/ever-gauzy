import { Connection } from 'typeorm';
import { Tenant } from '../tenant/tenant.entity';
import { BillingInvoicingPolicyEnum, IOrganization } from '@gauzy/models';
import { ProductVariant } from './product-variant.entity';
import * as faker from 'faker';
import { ProductCategory } from '../product-category/product-category.entity';
import { Product } from '../product/product.entity';
import { ProductOption } from '../product-option/product-option.entity';
import { ProductVariantSettings } from '../product-settings/product-settings.entity';
import { ProductVariantPrice } from '../product-variant-price/product-variant-price.entity';

export const createRandomProductVariant = async (
	connection: Connection,
	tenants: Tenant[],
	tenantOrganizationsMap: Map<Tenant, IOrganization[]>,
	numberOfVariantPerProduct
): Promise<ProductVariant[]> => {
	if (!tenantOrganizationsMap) {
		console.warn(
			'Warning: tenantOrganizationsMap not found, Product Variant will not be created'
		);
		return;
	}

	const productVariants: ProductVariant[] = [];

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
					const productOptions = await connection.manager.find(
						ProductOption,
						{
							where: [{ product: product }]
						}
					);

					for (let i = 0; i < numberOfVariantPerProduct; i++) {
						const productVariant = new ProductVariant();

						productVariant.notes = faker.name.jobDescriptor();
						productVariant.productId = product.id;
						productVariant.quantity = faker.random.number(20);
						productVariant.billingInvoicingPolicy = faker.random.arrayElement(
							Object.keys(BillingInvoicingPolicyEnum)
						);
						productVariant.enabled = faker.random.boolean();
						productVariant.options = productOptions;
						productVariant.settings = new ProductVariantSettings();
						productVariant.price = new ProductVariantPrice();
						productVariant.product = product;
						productVariant.tenant = tenant;
						productVariant.organization = tenantOrg;

						productVariants.push(productVariant);
					}
				}
			}
		}
	}

	await connection.manager.save(productVariants);
};
